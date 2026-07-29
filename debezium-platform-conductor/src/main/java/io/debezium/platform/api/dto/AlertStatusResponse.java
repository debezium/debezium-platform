/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.Severity;

public record AlertStatusResponse(
        int totalFiring,
        int totalPending,
        Map<Severity, Integer> firingBySeverity,
        List<ActiveAlertResponse> activeAlerts) {

    public record ActiveAlertResponse(
            Long ruleId,
            String ruleName,
            String pipelineId,
            AlertStateValue state,
            Severity severity,
            double value,
            double threshold,
            Instant since) {
    }
}
