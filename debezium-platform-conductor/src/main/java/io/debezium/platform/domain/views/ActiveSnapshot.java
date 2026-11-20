/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.time.Instant;
import java.util.List;

import com.blazebit.persistence.view.EntityView;

import io.debezium.platform.data.model.ActiveSnapshotEntity;

@EntityView(ActiveSnapshotEntity.class)
public interface ActiveSnapshot extends ActiveSnapshotSummary {

    String getCorrelationId();

    int getTotalTables();

    Instant getStartedAt();

    Instant getLastUpdatedAt();

    List<ActiveSnapshotTable> getTables();
}
