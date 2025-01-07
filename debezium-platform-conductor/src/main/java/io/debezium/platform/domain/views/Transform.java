/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import com.blazebit.persistence.view.CreatableEntityView;
import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.UpdatableEntityView;

import io.debezium.platform.data.model.TransformEntity;

@EntityView(TransformEntity.class)
@CreatableEntityView
@UpdatableEntityView
public interface Transform extends PipelineComponent {
}
