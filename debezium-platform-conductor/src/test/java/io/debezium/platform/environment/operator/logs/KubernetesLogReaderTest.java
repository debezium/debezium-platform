/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.logs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Proxy;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;

import io.fabric8.kubernetes.client.dsl.LogWatch;
import io.fabric8.kubernetes.client.dsl.PrettyLoggable;
import io.fabric8.kubernetes.client.dsl.TailPrettyLoggable;

class KubernetesLogReaderTest {

    @Test
    void shouldCloseWatchWhenReaderCloseFails() throws IOException {
        AtomicBoolean watchClosed = new AtomicBoolean();
        InputStream output = new InputStream() {
            @Override
            public int read() {
                return -1;
            }

            @Override
            public void close() throws IOException {
                throw new IOException("reader close failed");
            }
        };
        LogWatch watch = (LogWatch) Proxy.newProxyInstance(
                LogWatch.class.getClassLoader(),
                new Class<?>[]{ LogWatch.class },
                (proxy, method, args) -> {
                    return switch (method.getName()) {
                        case "getOutput" -> output;
                        case "onClose" -> CompletableFuture.completedFuture(null);
                        case "close" -> {
                            watchClosed.set(true);
                            yield null;
                        }
                        case "toString" -> "test-watch";
                        default -> throw new UnsupportedOperationException(method.getName());
                    };
                });
        PrettyLoggable tailedLog = (PrettyLoggable) Proxy.newProxyInstance(
                PrettyLoggable.class.getClassLoader(),
                new Class<?>[]{ PrettyLoggable.class },
                (proxy, method, args) -> {
                    return switch (method.getName()) {
                        case "watchLog" -> watch;
                        case "toString" -> "test-loggable";
                        default -> throw new UnsupportedOperationException(method.getName());
                    };
                });
        TailPrettyLoggable loggable = (TailPrettyLoggable) Proxy.newProxyInstance(
                TailPrettyLoggable.class.getClassLoader(),
                new Class<?>[]{ TailPrettyLoggable.class },
                (proxy, method, args) -> {
                    return switch (method.getName()) {
                        case "tailingLines" -> tailedLog;
                        case "toString" -> "test-tail-loggable";
                        default -> throw new UnsupportedOperationException(method.getName());
                    };
                });

        KubernetesLogReader reader = new KubernetesLogReader(() -> loggable);
        reader.reader();

        assertThatThrownBy(reader::close)
                .isInstanceOf(IOException.class)
                .hasMessage("reader close failed");
        assertThat(watchClosed).isTrue();
    }
}
