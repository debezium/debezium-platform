/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views.refs;

import com.blazebit.persistence.view.EntityView;

import io.debezium.platform.data.model.ActiveSnapshotEntity;
import io.debezium.platform.domain.views.base.IdView;

@EntityView(ActiveSnapshotEntity.class)
public interface ActiveSnapshotReference extends IdView {
}
