/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.logs;

import java.io.BufferedReader;
import java.io.Closeable;
import java.io.IOException;

public interface LogReader extends Closeable {

    /**
     * Reads the entire log content currently available.
     *
     * @return the log content
     */
    String readAll();

    /**
     * Obtains a {@link BufferedReader} that can be used to read live logs
     * <p>
     * Note that if this method is called, the reader must be closed by calling {@link #close()}.
     * </p
     *
     * @return a {@link BufferedReader} that can be used to read the log
     * @throws IOException if an I/O error occurs
     */
    BufferedReader reader() throws IOException;

    /**
     * Reads a single line from the log.
     * <p>
     * This method is a shortcut for calling {@link #reader()} and then {@link BufferedReader#readLine()}.
     * <br>
     * Note that if this method is called, the reader must be closed by calling {@link #close()}.
     * </p>
     *
     * @return the line read from the log, or {@code null} if the end of the stream has been reached
     * @throws IOException if an I/O error occurs
     */
    String readLine() throws IOException;

    /**
     * Closes the log reader and releases any resources associated
     * with it (e.g. {@link BufferedReader} returned by calling {@link #reader()}).
     */
    @Override
    void close() throws IOException;
}
