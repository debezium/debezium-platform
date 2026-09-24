/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.time.Instant;

import com.blazebit.persistence.view.EntityView;

import io.debezium.connector.SnapshotType;
import io.debezium.platform.data.model.SnapshotHistoryEntity;
import io.debezium.platform.data.model.SnapshotState;
import io.debezium.platform.domain.views.base.IdView;

/**
 * Lightweight projection of {@link SnapshotHistoryEntity} for the paginated history list; omits the
 * per-table breakdown so the list query stays lightweight. The full
 * {@link SnapshotHistory} view (with tables) backs the single-run detail endpoint.
 */
@EntityView(SnapshotHistoryEntity.class)
public interface SnapshotHistorySummary extends IdView {

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
}
