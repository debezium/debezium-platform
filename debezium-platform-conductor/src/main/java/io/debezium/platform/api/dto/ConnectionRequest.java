package io.debezium.platform.api.dto;

import java.util.Map;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import io.debezium.platform.data.model.ConnectionEntity;

public record ConnectionRequest(
        @NotEmpty String name,
        @NotNull ConnectionEntity.Type type,
        Map<String, Object> config) {
}
