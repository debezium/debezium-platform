/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.function.Supplier;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

import io.debezium.platform.environment.logs.LogReader;
import io.quarkus.virtual.threads.VirtualThreads;

@ApplicationScoped
public class LogStreamingService {

    private final Logger logger;
    private final ExecutorService executorService;

    /**
     * A running log stream. Deliberately not {@link java.io.Closeable}: the task routinely outlives
     * the scope that starts it, so being usable in a try-with-resources would invite stopping it the
     * moment that scope exits, before anything has been read. Callers stop it through
     * {@link #stop()}, at the point they actually know the stream is no longer wanted.
     */
    public static class LogStreamingTask implements Runnable {
        private final Logger logger;

        private final String name;
        private final AtomicBoolean running;
        private final AtomicBoolean stopped;
        private final Supplier<LogReader> supplier;
        private final Consumer<String> consumer;
        private final Consumer<Throwable> onFinished;
        private final AtomicReference<LogReader> activeReader;

        public LogStreamingTask(String name, Supplier<LogReader> supplier, Consumer<String> consumer, Logger logger, Consumer<Throwable> onFinished) {
            this.name = name;
            this.supplier = supplier;
            this.consumer = consumer;
            this.logger = logger;
            this.onFinished = onFinished;
            this.running = new AtomicBoolean(false);
            this.stopped = new AtomicBoolean(false);
            this.activeReader = new AtomicReference<>();
        }

        public String getName() {
            return name;
        }

        public boolean isRunning() {
            return running.get();
        }

        public void stop() {
            // Marked stopped first so a task that has been submitted but has not started yet never
            // begins streaming: stop() would otherwise be a no-op on it, and the subsequent run()
            // would push lines at a consumer nobody is listening to any more.
            stopped.set(true);
            if (running.compareAndSet(true, false)) {
                logger.infof("Stopping log streamer for '%s'", name);
            }
            // doStream() can be blocked inside readLine(), waiting on a log that has gone quiet rather
            // than ended, with no further line to return isRunning() to and notice the stop above:
            // closing the reader out from under it is what forces that read to give up.
            closeActiveReader();
        }

        @Override
        public void run() {
            if (stopped.get() || !running.compareAndSet(false, true)) {
                return;
            }
            logger.infof("Starting log streamer for '%s'", name);

            Throwable failure = null;
            try {
                LogReader reader = supplier.get();
                activeReader.set(reader);
                doStream(reader);
                logger.infof("Finished streaming from log %s", name);
            }
            catch (IOException | RuntimeException e) {
                // Closing the reader to force stop() out of a blocked readLine() (above) surfaces here
                // as a failure too, even though nothing actually went wrong reading the log.
                if (!stopped.get()) {
                    logger.errorf(e, "Error streaming from log %s", name);
                    failure = e;
                }
            }
            finally {
                closeActiveReader();
                stop();
                onFinished.accept(failure);
            }
        }

        private void closeActiveReader() {
            LogReader reader = activeReader.getAndSet(null);
            if (reader != null) {
                try {
                    reader.close();
                }
                catch (IOException e) {
                    logger.errorf(e, "Error closing log reader for '%s'", name);
                }
            }
        }

        // A null line means the log itself has ended (LogReader#readLine), not that none is available
        // yet: a live log that merely has nothing new right now blocks inside readLine() until either
        // a line or that end arrives, rather than returning null for it.
        private void doStream(LogReader reader) throws IOException {
            while (isRunning()) {
                var line = reader.readLine();
                if (line == null) {
                    return;
                }
                consumer.accept(line);
            }
        }
    }

    public LogStreamingService(Logger logger, @VirtualThreads ExecutorService executorService) {
        this.logger = logger;
        this.executorService = executorService;
    }

    /**
     * Starts streaming the log, passing each line to given consumer.
     *
     * @param consumer   log consumer
     * @param onFinished invoked once the task has stopped streaming, with {@code null} if the log
     *                   ended or {@link LogStreamingTask#stop()} was called, or the failure otherwise
     */
    public LogStreamingTask stream(String name, Supplier<LogReader> logSupplier, Consumer<String> consumer, Consumer<Throwable> onFinished) {
        logger.infof("Starting log streamer for log %s", name);
        var task = new LogStreamingTask(name, logSupplier, consumer, logger, onFinished);
        executorService.submit(task);
        return task;
    }
}
