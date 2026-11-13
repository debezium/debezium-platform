/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import com.blazebit.persistence.view.EntityView;

import io.debezium.connector.SnapshotType;
import io.debezium.platform.data.model.ActiveSnapshotEntity;
import io.debezium.platform.data.model.SnapshotState;
import io.debezium.platform.domain.views.base.IdView;

/**
 * Lightweight projection of {@link ActiveSnapshotEntity} for the pipeline listing; omits the
 * per-table breakdown so the list query stays lightweight. The full
 * {@link ActiveSnapshot} view (with tables) backs the single-pipeline snapshot progress endpoint.
 */
@EntityView(ActiveSnapshotEntity.class)
public interface ActiveSnapshotSummary extends IdView {

    Long getPipelineId();

    SnapshotType getType();

    SnapshotState getStatus();
}
