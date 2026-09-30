/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.logs;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.io.InputStream;

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
}
