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
import io.debezium.platform.data.model.SnapshotHistoryEntity;
import io.debezium.platform.data.model.SnapshotState;
import io.debezium.platform.domain.views.base.IdView;

@EntityView(SnapshotHistoryEntity.class)
public interface SnapshotHistory extends IdView {

    Long getPipelineId();

    String getPipelineName();

    SnapshotType getType();

    SnapshotState getOutcome();

    int getTotalTables();

    int getCompletedTables();

    long getTotalRowsScanned();

    Instant getStartedAt();

    Instant getCompletedAt();

    long getDurationSeconds();

    List<SnapshotTableHistory> getTables();
}
