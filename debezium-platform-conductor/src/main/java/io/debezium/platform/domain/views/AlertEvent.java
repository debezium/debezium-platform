/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.time.Instant;

import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.Mapping;

import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.Severity;
import io.debezium.platform.domain.views.base.IdView;

@EntityView(AlertEventEntity.class)
public interface AlertEvent extends IdView {

    @Mapping("rule.id")
    Long getRuleId();

    String getRuleName();

    String getPipelineId();

    String getPipelineName();

    Double getValue();

    double getThreshold();

    Severity getSeverity();

    String getMessage();

    Instant getFiredAt();

    Instant getResolvedAt();

    Instant getCreatedAt();
}
