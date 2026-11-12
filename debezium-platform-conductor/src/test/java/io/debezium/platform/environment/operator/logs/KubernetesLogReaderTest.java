/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.logs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.io.InputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

import io.debezium.doc.FixFor;
import io.fabric8.kubernetes.client.dsl.LogWatch;
import io.fabric8.kubernetes.client.dsl.PrettyLoggable;
import io.fabric8.kubernetes.client.dsl.TailPrettyLoggable;

class KubernetesLogReaderTest {

    @Test
    @FixFor("debezium/dbz#2722")
    void shouldCloseWatchWhenReaderCloseFails() throws IOException {
        InputStream output = mock(InputStream.class);
        doThrow(new IOException("reader close failed")).when(output).close();
        LogWatch watch = mock(LogWatch.class);
        when(watch.getOutput()).thenReturn(output);
        PrettyLoggable tailedLog = mock(PrettyLoggable.class);
        when(tailedLog.watchLog()).thenReturn(watch);
        TailPrettyLoggable loggable = mock(TailPrettyLoggable.class);
        when(loggable.tailingLines(KubernetesLogReader.STREAM_TAIL_LINES)).thenReturn(tailedLog);

        KubernetesLogReader reader = new KubernetesLogReader(() -> loggable);
        reader.reader();

        assertThatThrownBy(reader::close)
                .isInstanceOf(IOException.class)
                .hasMessage("reader close failed");
        verify(watch).close();
    }

    @Test
    @FixFor("debezium/dbz#3004")
    void closingUnblocksAConcurrentReadLine() throws Exception {
        // A real loopback socket, not a mock: closing one end from another thread reliably interrupts
        // a read() blocked on it, the same as closing the OkHttp-backed stream behind a real Kubernetes
        // log watch does, so this actually proves close() does not itself wait on the very read it is
        // meant to interrupt. Nothing is ever written to it, standing in for a live but quiet log.
        try (ServerSocket serverSocket = new ServerSocket(0);
                Socket writerSide = new Socket("localhost", serverSocket.getLocalPort());
                Socket readerSide = serverSocket.accept()) {
            InputStream blockingOutput = readerSide.getInputStream();

            LogWatch watch = mock(LogWatch.class);
            when(watch.getOutput()).thenReturn(blockingOutput);
            doAnswer(invocation -> {
                readerSide.close();
                return null;
            }).when(watch).close();
            PrettyLoggable tailedLog = mock(PrettyLoggable.class);
            when(tailedLog.watchLog()).thenReturn(watch);
            TailPrettyLoggable loggable = mock(TailPrettyLoggable.class);
            when(loggable.tailingLines(KubernetesLogReader.STREAM_TAIL_LINES)).thenReturn(tailedLog);

            KubernetesLogReader reader = new KubernetesLogReader(() -> loggable);

            CountDownLatch readingStarted = new CountDownLatch(1);
            Thread readingThread = new Thread(() -> {
                try {
                    readingStarted.countDown();
                    reader.readLine();
                }
                catch (IOException expected) {
                    // Expected once close() ends the underlying stream.
                }
            });
            // A daemon thread, so that if this fix ever regresses and the read is not actually
            // unblocked, this test fails on the assertion below rather than hanging the whole build.
            readingThread.setDaemon(true);
            readingThread.start();
            assertThat(readingStarted.await(5, TimeUnit.SECONDS)).isTrue();
            // Lets readLine() actually reach its blocking read, rather than racing close() against it
            // still merely starting up.
            Thread.sleep(200);

            reader.close();

            readingThread.join(TimeUnit.SECONDS.toMillis(5));
            assertThat(readingThread.isAlive()).isFalse();
        }
    }

    @Test
    @FixFor("debezium/dbz#3004")
    void refusesToOpenANewWatchAfterBeingClosed() throws Exception {
        TailPrettyLoggable loggable = mock(TailPrettyLoggable.class);
        KubernetesLogReader reader = new KubernetesLogReader(() -> loggable);

        // Simulates LogStreamingService.LogStreamingTask#stop() running before the first read: nothing
        // has been opened yet, so this closes nothing, but must still prevent one from opening later.
        reader.close();

        assertThatThrownBy(reader::readLine).isInstanceOf(IOException.class);
        verifyNoInteractions(loggable);
    }
}
