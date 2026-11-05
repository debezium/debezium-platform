/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.function.Supplier;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

import io.debezium.platform.environment.logs.LogReader;
import io.quarkus.virtual.threads.VirtualThreads;

@ApplicationScoped
public class LogStreamingService {

    public static final int NO_DATA_SLEEP_MS = 1000;

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
        private final Runnable onFinished;

        public LogStreamingTask(String name, Supplier<LogReader> supplier, Consumer<String> consumer, Logger logger, Runnable onFinished) {
            this.name = name;
            this.supplier = supplier;
            this.consumer = consumer;
            this.logger = logger;
            this.onFinished = onFinished;
            this.running = new AtomicBoolean(false);
            this.stopped = new AtomicBoolean(false);
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
        }

        @Override
        public void run() {
            if (stopped.get() || !running.compareAndSet(false, true)) {
                return;
            }
            logger.infof("Starting log streamer for '%s'", name);

            try (var reader = supplier.get()) {
                doStream(reader);
                logger.infof("Finished streaming from log %s", name);
            }
            catch (IOException e) {
                logger.errorf("Error streaming from log %s", name);
            }
            catch (InterruptedException e) {
                logger.errorf("Interrupted while waiting for more logs from log %s", name);
                Thread.currentThread().interrupt();
            }
            finally {
                stop();
                onFinished.run();
            }
        }

        private void doStream(LogReader reader) throws InterruptedException, IOException {
            while (isRunning()) {
                var line = reader.readLine();
                if (line == null) {
                    Thread.sleep(NO_DATA_SLEEP_MS);
                    continue;
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
     * @param onFinished invoked once the task has stopped streaming, whether because the log ended,
     *                   it failed, or {@link LogStreamingTask#stop()} was called
     */
    public LogStreamingTask stream(String name, Supplier<LogReader> logSupplier, Consumer<String> consumer, Runnable onFinished) {
        logger.infof("Starting log streamer for log %s", name);
        var task = new LogStreamingTask(name, logSupplier, consumer, logger, onFinished);
        executorService.submit(task);
        return task;
    }
}
