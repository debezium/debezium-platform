/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.ReduceFunction;
import io.debezium.platform.data.model.Severity;

public record AlertRuleResponse(
        Long id,
        String name,
        String description,
        String panelId,
        String panelTitle,
        Operator operator,
        double threshold,
        @Schema(description = "ISO-8601 duration for how long the condition must hold before firing", example = "PT5M") Duration forDuration,
        ReduceFunction reduceFunction,
        @Schema(description = "ISO-8601 duration for the evaluation window", example = "PT5M") Duration evaluationWindow,
        Severity severity,
        boolean enabled,
        List<ChannelSummary> channels,
        Instant createdAt,
        Instant updatedAt) {

    public record ChannelSummary(Long id, String name, ChannelType type) {
    }
}
