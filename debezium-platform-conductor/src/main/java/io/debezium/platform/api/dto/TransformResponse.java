package io.debezium.platform.api.dto;

import java.util.Map;
import java.util.Set;

public record TransformResponse(
        Long id,
        String name,
        String description,
        String type,
        String schema,
        Set<NamedRef> vaults,
        Map<String, Object> config,
        PredicateDto predicate) {
}
