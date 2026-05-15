package io.debezium.platform.domain;

import io.debezium.platform.environment.logs.LogReader;
import io.quarkus.virtual.threads.VirtualThreads;
import jakarta.enterprise.context.ApplicationScoped;
import lombok.Getter;
import org.jboss.logging.Logger;

import java.io.Closeable;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.function.Supplier;

@ApplicationScoped
public class LogStreamingService {

    public static final int NO_DATA_SLEEP_MS = 1000;

    private final Logger logger;
    private final ExecutorService executorService;

    public static class LogStreamingTask implements Runnable, Closeable {
        private final Logger logger;

        @Getter
        private final String name;
        private final AtomicBoolean running;
        private final Supplier<LogReader> supplier;
        private final Consumer<String> consumer;

        public LogStreamingTask(String name, Supplier<LogReader> supplier, Consumer<String> consumer, Logger logger) {
            this.name = name;
            this.supplier = supplier;
            this.consumer = consumer;
            this.logger = logger;
            this.running = new AtomicBoolean(false);
        }

        public boolean isRunning() {
            return running.get();
        }

        public void stop() {
            if (!running.compareAndSet(true, false)) {
                logger.infof("Stopping log streamer for '%s'", name);
            }
        }

        @Override
        public void run() {
            if (!running.compareAndSet(false, true)) {
                return;
            }
            logger.infof("Starting log streamer for '%s'", name);

            try (var reader = supplier.get()) {
                doStream(reader);
                logger.infof("Finished streaming from log %s", name);
            } catch (IOException e) {
                logger.errorf("Error streaming from log %s", name);
            } catch (InterruptedException e) {
                logger.errorf("Interrupted while waiting for more logs from log %s", name);
                Thread.currentThread().interrupt();
            } finally {
                stop();
            }
        }

        private void doStream(LogReader reader) throws InterruptedException, IOException {
            while (isRunning()) {
                var line = reader.readLine();
                if (line == null) {
                    Thread.sleep(NO_DATA_SLEEP_MS);
                }
                consumer.accept(line);
            }
        }

        @Override
        public void close() {
            stop();
        }
    }

    public LogStreamingService(Logger logger, @VirtualThreads ExecutorService executorService) {
        this.logger = logger;
        this.executorService = executorService;
    }

    /**
     * Starts streaming the log, passing each line to given consumer.
     *
     * @param consumer log consumer
     */
    public LogStreamingTask stream(String name, Supplier<LogReader> logSupplier, Consumer<String> consumer) {
        logger.infof("Starting log streamer for log %s", name);
        var task  = new LogStreamingTask(name, logSupplier, consumer, logger);
        executorService.submit(task);
        return task;
    }
}
