/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.watcher.consumers;

import java.util.function.Consumer;

import jakarta.enterprise.context.Dependent;
import jakarta.enterprise.inject.Instance;

import org.apache.kafka.connect.data.Struct;
import org.apache.kafka.connect.source.SourceRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.engine.ChangeEvent;
import io.debezium.platform.environment.watcher.config.OutboxConfigGroup;
import io.fabric8.kubernetes.client.KubernetesClientException;

/**
 * Top level consumer of outbox events. Parent consumer will extract
 * required information from the accepted {@link ChangeEvent} and delegate
 * to all registered instances of {@link EnvironmentEventConsumer}
 * <br>
 *
 * It's then up to {@link EnvironmentEventConsumer} instances to either process
 * or ignore the event.
 */
@Dependent
public final class OutboxParentEventConsumer implements Consumer<ChangeEvent<SourceRecord, SourceRecord>> {

    private static final Logger LOGGER = LoggerFactory.getLogger(OutboxParentEventConsumer.class);
    private static final int MAX_RETRIES = 3;

    private final OutboxConfigGroup outbox;
    private final Instance<EnvironmentEventConsumer<?>> eventConsumers;

    public OutboxParentEventConsumer(OutboxConfigGroup outbox, Instance<EnvironmentEventConsumer<?>> eventConsumers) {
        this.outbox = outbox;
        this.eventConsumers = eventConsumers;
    }

    @Override
    public void accept(ChangeEvent<SourceRecord, SourceRecord> event) {
        var value = (Struct) event.value().value();

        if (value == null || value.schema().field(outbox.aggregateColumn()) == null) {
            return;
        }

        var context = EventContext.from(value, outbox);

        LOGGER.debug("Consumed {} event for {} (#{}) with payload {}",
                context.eventType(), context.aggregateType(), context.aggregateId(), context.payload());

        eventConsumers.forEach(consumer -> consumeWithRetry(consumer, context));
    }

    private void consumeWithRetry(EnvironmentEventConsumer<?> consumer, EventContext context) {

        for (int attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
            try {
                consumer.consume(context.aggregateType(), context.eventType(),
                        Long.valueOf(context.aggregateId()), context.payload());
                return;
            }
            catch (Exception e) {
                if (isRetriable(e) && attempt <= MAX_RETRIES) {
                    var delay = backoffDelay(attempt);
                    LOGGER.warn("Retriable error processing {} event for aggregate {} (#{}),"
                            + " attempt {}/{}, retrying in {}ms",
                            context.eventType(), context.aggregateType(), context.aggregateId(),
                            attempt, MAX_RETRIES, delay, e);
                    if (!sleep(delay)) {
                        return;
                    }
                }
                else {
                    LOGGER.error("Failed to process {} event for aggregate {} (#{}){}. Skipping event.",
                            context.eventType(), context.aggregateType(), context.aggregateId(),
                            attempt > 1 ? " after %d retries".formatted(attempt - 1) : "",
                            e);
                    return;
                }
            }
        }
    }

    private long backoffDelay(int attempt) {
        return (long) Math.pow(2, attempt - 1) * 1000;
    }

    private boolean sleep(long millis) {
        try {
            Thread.sleep(millis);
            return true;
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private boolean isRetriable(Throwable throwable) {
        for (var current = throwable; current != null; current = current.getCause()) {
            if (current instanceof KubernetesClientException) {
                return true;
            }
        }
        return false;
    }

    private record EventContext(String aggregateType, String aggregateId, String eventType, String payload) {

        static EventContext from(Struct value, OutboxConfigGroup outbox) {
            return new EventContext(
                    value.getString(outbox.aggregateColumn()),
                    value.getString(outbox.aggregateIdColumn()),
                    value.getString(outbox.typeColumn()),
                    value.getString("payload"));
        }
    }
}
