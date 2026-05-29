package io.debezium.platform.environment.watcher.events;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.debezium.platform.domain.views.flat.PipelineFlat;

import java.time.Instant;

public final class PipelineEvent extends AbstractEvent {

    private static final String AGGREGATE_TYPE = "pipeline";

    private PipelineEvent(String aggregateId, EventType type, Instant timestamp, JsonNode payload) {
        super(AGGREGATE_TYPE, aggregateId, type, timestamp, payload);
    }

    public static PipelineEvent update(PipelineFlat pipeline, ObjectMapper objectMapper) {
        var payload = objectMapper.valueToTree(pipeline);
        return new PipelineEvent(pipeline.getId().toString(), EventType.UPDATE, Instant.now(), payload);
    }

    public static PipelineEvent delete(Long id) {
        return new PipelineEvent(id.toString(), EventType.DELETE, Instant.now(), null);
    }
}
