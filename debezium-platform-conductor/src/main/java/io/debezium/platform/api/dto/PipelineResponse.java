package io.debezium.platform.api.dto;

import java.util.List;
import java.util.Map;

public record PipelineResponse(
        Long id,
        String name,
        String description,
        NamedRef source,
        NamedRef destination,
        List<NamedRef> transforms,
        String logLevel,
        Map<String, String> logLevels) {
}
