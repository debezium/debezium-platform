/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.time.Instant;

import io.debezium.platform.data.model.Severity;

public record AlertEventResponse(
        Long id,
        Long ruleId,
        String ruleName,
        String pipelineId,
        String pipelineName,
        String status,
        Double value,
        double threshold,
        Severity severity,
        String message,
        Instant firedAt,
        Instant resolvedAt,
        Long durationSeconds,
        Instant createdAt) {
}
