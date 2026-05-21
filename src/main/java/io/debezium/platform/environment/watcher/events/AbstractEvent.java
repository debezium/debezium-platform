package io.debezium.platform.environment.watcher.events;

import com.fasterxml.jackson.databind.JsonNode;
import io.debezium.outbox.quarkus.ExportedEvent;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

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
