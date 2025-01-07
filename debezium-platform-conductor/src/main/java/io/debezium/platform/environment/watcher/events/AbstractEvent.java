/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.watcher.events;

import java.time.Instant;

import com.fasterxml.jackson.databind.JsonNode;

import io.debezium.outbox.quarkus.ExportedEvent;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public abstract class AbstractEvent
        implements ExportedEvent<String, JsonNode> {

    private final String aggregateType;
    private final String aggregateId;
    private final String type;
    private final JsonNode payload;
    private final Instant timestamp;

    public AbstractEvent(
                         String aggregateType,
                         String aggregateId,
                         EventType type,
                         Instant timestamp,
                         JsonNode payload) {
        this.aggregateType = aggregateType;
        this.aggregateId = aggregateId;
        this.type = type.name();
        this.payload = payload;
        this.timestamp = timestamp;
    }
}
