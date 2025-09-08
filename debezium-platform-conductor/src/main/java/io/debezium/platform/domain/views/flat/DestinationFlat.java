/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views.flat;

import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.UpdatableEntityView;

import io.debezium.platform.data.model.DestinationEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.domain.views.PipelineComponent;

@EntityView(DestinationEntity.class)
@UpdatableEntityView
public interface DestinationFlat extends PipelineComponent {

    Connection getConnection();

    void setConnection(Connection connection);
}
