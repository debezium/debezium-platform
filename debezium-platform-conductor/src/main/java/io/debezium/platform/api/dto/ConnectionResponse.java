package io.debezium.platform.api.dto;

import java.util.Map;

import io.debezium.platform.data.model.ConnectionEntity;

public record ConnectionResponse(
        Long id,
        String name,
        ConnectionEntity.Type type,
        Map<String, Object> config) {
}
