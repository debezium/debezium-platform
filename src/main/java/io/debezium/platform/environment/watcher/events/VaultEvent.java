package io.debezium.platform.environment.watcher.events;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.debezium.platform.domain.views.Vault;

import java.time.Instant;

public final class VaultEvent extends AbstractEvent {

    private static final String AGGREGATE_TYPE = "vault";

    private VaultEvent(String aggregateId, EventType type, Instant timestamp, JsonNode payload) {
        super(AGGREGATE_TYPE, aggregateId, type, timestamp, payload);
    }

    public static VaultEvent update(Vault vault, ObjectMapper objectMapper) {
        var payload = objectMapper.valueToTree(vault);
        return new VaultEvent(vault.getId().toString(), EventType.UPDATE, Instant.now(), payload);
    }

    public static VaultEvent delete(Long id) {
        return new VaultEvent(id.toString(), EventType.DELETE, Instant.now(), null);
    }
}
