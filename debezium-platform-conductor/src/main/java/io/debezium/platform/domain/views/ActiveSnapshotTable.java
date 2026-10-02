/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.time.Instant;

import com.blazebit.persistence.view.EntityView;

import io.debezium.platform.data.model.ActiveSnapshotTableEntity;
import io.debezium.platform.data.model.TableState;
import io.debezium.platform.domain.views.base.IdView;

@EntityView(ActiveSnapshotTableEntity.class)
public interface ActiveSnapshotTable extends IdView {

    String getTableName();

    TableState getState();

    int getOrderIndex();

    long getRowsScanned();

    String getSkipReason();

    Instant getStartedAt();

    Instant getCompletedAt();
}
