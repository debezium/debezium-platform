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
import org.jboss.logging.Logger;

import io.debezium.engine.ChangeEvent;
import io.debezium.platform.environment.watcher.config.OutboxConfigGroup;

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

    private final Logger logger;
    private final OutboxConfigGroup outbox;
    private final Instance<EnvironmentEventConsumer<?>> eventConsumers;

    public OutboxParentEventConsumer(Logger logger, OutboxConfigGroup outbox, Instance<EnvironmentEventConsumer<?>> eventConsumers) {
        this.logger = logger;
        this.outbox = outbox;
        this.eventConsumers = eventConsumers;
    }

    @Override
    public void accept(ChangeEvent<SourceRecord, SourceRecord> event) {
        var value = (Struct) event.value().value();

        var aggregateType = value.getString(outbox.aggregateColumn());
        var aggregateId = value.getString(outbox.aggregateIdColumn());
        var eventType = value.getString(outbox.typeColumn());
        var payload = value.getString("payload");

        logger.debugf("Consumed %s event for % (#%d)", eventType, aggregateType, aggregateId);

        eventConsumers.forEach(consumer -> consumer.consume(
                aggregateType, eventType, Long.valueOf(aggregateId), payload));
    }
}
