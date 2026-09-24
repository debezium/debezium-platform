/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.time.Instant;
import java.util.List;

import com.blazebit.persistence.view.EntityView;

import io.debezium.connector.SnapshotType;
import io.debezium.platform.data.model.ActiveSnapshotEntity;
import io.debezium.platform.data.model.SnapshotState;
import io.debezium.platform.domain.views.base.IdView;

@EntityView(ActiveSnapshotEntity.class)
public interface ActiveSnapshot extends IdView {

    Long getPipelineId();

    SnapshotType getType();

    SnapshotState getStatus();

    String getCorrelationId();

    int getTotalTables();

    Instant getStartedAt();

    Instant getLastUpdatedAt();

    List<ActiveSnapshotTable> getTables();
}
