package io.debezium.platform.api.dto;

import java.util.Map;
import java.util.Set;

public record SourceResponse(
        Long id,
        String name,
        String description,
        String type,
        String schema,
        NamedRef connection,
        Set<NamedRef> vaults,
        Map<String, Object> config) {
}
