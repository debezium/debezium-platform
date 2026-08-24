/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.time.Instant;

import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.Mapping;

import io.debezium.platform.data.model.AlertStateEntity;
import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.domain.views.base.IdView;

@EntityView(AlertStateEntity.class)
public interface AlertState extends IdView {

    @Mapping("rule.id")
    Long getRuleId();

    String getPipelineId();

    AlertStateValue getState();

    Double getValue();

    Instant getPendingSince();

    Instant getFiredAt();

    Instant getLastEvaluatedAt();
}
