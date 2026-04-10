/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record PipelineRequest(
        @NotEmpty String name,
        String description,
        @NotNull NamedRef source,
        @NotNull NamedRef destination,
        List<NamedRef> transforms,
        @NotEmpty String logLevel,
        Map<String, String> logLevels) {
}
