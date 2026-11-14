/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.BufferedReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.debezium.doc.FixFor;
import io.debezium.platform.domain.LogStreamingService.LogStreamingTask;
import io.debezium.platform.environment.logs.LogReader;

@ExtendWith(MockitoExtension.class)
class LogStreamingServiceTest {

    private static final Logger LOGGER = Logger.getLogger(LogStreamingServiceTest.class);

    @Mock
    private LogReader reader;

    @Test
    @FixFor("debezium/dbz#3004")
    void reportsNoFailureWhenTheLogEndsCleanly() throws Exception {
        when(reader.readLine()).thenReturn("a line", (String) null);

        List<String> lines = new ArrayList<>();
        AtomicReference<Throwable> reportedFailure = new AtomicReference<>();
        var task = new LogStreamingTask("test", () -> reader, lines::add, LOGGER, reportedFailure::set);

        task.run();

        assertThat(lines).containsExactly("a line");
        assertThat(reportedFailure).hasValue(null);
        verify(reader).close();
    }

    @Test
    @FixFor("debezium/dbz#3004")
    void reportsTheFailureWhenReadingTheLogFails() throws Exception {
        IOException failure = new IOException("broken log stream");
        when(reader.readLine()).thenThrow(failure);

        AtomicReference<Throwable> reportedFailure = new AtomicReference<>();
        var task = new LogStreamingTask("test", () -> reader, line -> {
        }, LOGGER, reportedFailure::set);

        task.run();

        assertThat(reportedFailure).hasValue(failure);
        verify(reader).close();
    }

    @Test
    @FixFor("debezium/dbz#3004")
    void closesTheReaderToUnblockAReadWhenStopped() throws Exception {
        CountDownLatch readingStarted = new CountDownLatch(1);
        AtomicBoolean closed = new AtomicBoolean();
        LogReader blockingReader = new LogReader() {
            private volatile Thread blockedThread;

            @Override
            public String readLine() throws IOException {
                blockedThread = Thread.currentThread();
                readingStarted.countDown();
                try {
                    // Stands in for a live log that has gone quiet: readLine() blocks until either a
                    // line or the end of the log arrives, neither of which is ever going to happen here.
                    Thread.sleep(Long.MAX_VALUE);
                }
                catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IOException("closed while reading", e);
                }
                return null;
            }

            @Override
            public String readAll() {
                throw new UnsupportedOperationException();
            }

            @Override
            public BufferedReader reader() {
                throw new UnsupportedOperationException();
            }

            @Override
            public void close() {
                closed.set(true);
                Thread thread = blockedThread;
                if (thread != null) {
                    thread.interrupt();
                }
            }
        };

        AtomicReference<Throwable> reportedFailure = new AtomicReference<>();
        var task = new LogStreamingTask("test", () -> blockingReader, line -> {
        }, LOGGER, reportedFailure::set);
        Thread taskThread = new Thread(task);
        taskThread.start();
        assertThat(readingStarted.await(5, TimeUnit.SECONDS)).isTrue();

        task.stop();

        taskThread.join(TimeUnit.SECONDS.toMillis(5));
        assertThat(taskThread.isAlive()).isFalse();
        assertThat(closed).isTrue();
        assertThat(reportedFailure).hasValue(null);
    }

    @Test
    @FixFor("debezium/dbz#3004")
    void neverStartsATaskThatWasStoppedBeforeItRan() {
        AtomicBoolean supplierCalled = new AtomicBoolean();
        var task = new LogStreamingTask("test", () -> {
            supplierCalled.set(true);
            return reader;
        }, line -> {
        }, LOGGER, failure -> {
        });

        task.stop();
        task.run();

        assertThat(supplierCalled).isFalse();
    }

    @Test
    @FixFor("debezium/dbz#3004")
    void reportsTheFailureWhenOpeningTheLogFails() {
        RuntimeException failure = new RuntimeException("could not open log");
        AtomicReference<Throwable> reportedFailure = new AtomicReference<>();
        var task = new LogStreamingTask("test", () -> {
            throw failure;
        }, line -> {
        }, LOGGER, reportedFailure::set);

        task.run();

        assertThat(reportedFailure).hasValue(failure);
    }
}
