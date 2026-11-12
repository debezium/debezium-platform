/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
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
