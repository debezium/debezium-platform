/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import com.blazebit.persistence.view.EntityView;

import io.debezium.platform.data.model.SnapshotTableHistoryEntity;
import io.debezium.platform.data.model.TableState;
import io.debezium.platform.domain.views.base.IdView;

@EntityView(SnapshotTableHistoryEntity.class)
public interface SnapshotTableHistory extends IdView {

    String getTableName();

    TableState getOutcome();

    int getOrderIndex();

    long getRowsScanned();

    String getSkipReason();

    Long getDurationSeconds();
}
