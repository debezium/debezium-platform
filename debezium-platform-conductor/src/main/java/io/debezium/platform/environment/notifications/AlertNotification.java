/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.notifications;

import java.time.Instant;

import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.Severity;

public record AlertNotification(
        String ruleName,
        String pipelineId,
        String pipelineName,
        AlertStateValue state,
        Severity severity,
        double value,
        double threshold,
        Operator operator,
        String message,
        Instant firedAt,
        Instant resolvedAt) {
}
