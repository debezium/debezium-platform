package io.debezium.platform.api.dto;

import java.util.Map;

public record PredicateDto(
        String type,
        Map<String, Object> config,
        boolean negate) {
}
