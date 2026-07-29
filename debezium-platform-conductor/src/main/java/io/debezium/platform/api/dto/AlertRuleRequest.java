/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.time.Duration;
import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.ReduceFunction;
import io.debezium.platform.data.model.Severity;

public record AlertRuleRequest(
        @NotEmpty String name,
        String description,
        @NotEmpty String panelId,
        @NotNull Operator operator,
        @NotNull Double threshold,
        @Schema(description = "ISO-8601 duration for how long the condition must hold before firing. Default: PT0S (immediate). Max: PT1H", example = "PT5M") Duration forDuration,
        ReduceFunction reduceFunction,
        @Schema(description = "ISO-8601 duration for the evaluation window used with reduce functions other than LAST. Default: PT5M. Range: PT1M to PT1H", example = "PT5M") Duration evaluationWindow,
        Severity severity,
        Boolean enabled,
        List<Long> channelIds) {
}
