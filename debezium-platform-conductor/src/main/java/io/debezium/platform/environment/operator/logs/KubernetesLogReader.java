/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.logs;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Objects;
import java.util.function.Supplier;

import io.debezium.platform.environment.logs.LogReader;
import io.fabric8.kubernetes.client.KubernetesClientException;
import io.fabric8.kubernetes.client.dsl.LogWatch;
import io.fabric8.kubernetes.client.dsl.TailPrettyLoggable;

public class KubernetesLogReader implements LogReader {

    public static final int STREAM_TAIL_LINES = 100;

    private final Supplier<TailPrettyLoggable> supplier;
    private LogWatch watch;
    private BufferedReader reader;

    public KubernetesLogReader(Supplier<TailPrettyLoggable> supplier) {
        this.supplier = Objects.requireNonNull(supplier, "Supplier cannot be null");
    }

    public String readAll() {
        return supplier.get().getLog();
    }

    @Override
    public BufferedReader reader() throws IOException {
        return ensureReader();
    }

    @Override
    public String readLine() throws IOException {
        return reader().readLine();
    }

    @Override
    public void close() throws IOException {
        if (reader != null) {
            reader.close();
        }
        if (watch != null) {
            watch.close();
        }
    }

    private BufferedReader ensureReader() throws IOException {
        if (reader == null) {
            try {
                this.watch = supplier.get().tailingLines(STREAM_TAIL_LINES).watchLog();
                this.reader = new BufferedReader(new InputStreamReader(watch.getOutput()));
            }
            catch (KubernetesClientException e) {
                throw new IOException(e);
            }
        }
        return reader;
    }
}
