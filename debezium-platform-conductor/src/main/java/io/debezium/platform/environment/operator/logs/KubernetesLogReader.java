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
    private boolean closed;

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
    public synchronized void close() throws IOException {
        closed = true;
        // The watch is closed first: readLine() holds the BufferedReader's own lock for as long as
        // its underlying read blocks, so closing that reader first would, for a read blocked on a
        // quiet log, wait on the very lock this close is meant to free it from. Closing the watch
        // ends the underlying stream directly, which is what actually unblocks that read, letting it
        // throw and release the lock before reader.close() ever needs to acquire it.
        try {
            if (watch != null) {
                watch.close();
            }
        }
        finally {
            if (reader != null) {
                reader.close();
            }
        }
    }

    private synchronized BufferedReader ensureReader() throws IOException {
        if (closed) {
            // Without this, a reader closed (by LogStreamingService.LogStreamingTask#stop()) before its
            // first read, while watch and reader are still null and so this close() closes nothing,
            // would otherwise go on to lazily open a new, untracked watch right here instead.
            throw new IOException("Log reader is closed");
        }
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
