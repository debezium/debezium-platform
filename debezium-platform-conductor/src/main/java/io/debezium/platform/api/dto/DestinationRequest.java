package io.debezium.platform.api.dto;

import java.util.Map;
import java.util.Set;

import jakarta.validation.constraints.NotEmpty;

public record DestinationRequest(
        @NotEmpty String name,
        String description,
        @NotEmpty String type,
        @NotEmpty String schema,
        NamedRef connection,
        Set<NamedRef> vaults,
        Map<String, Object> config) {
}
