/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import com.blazebit.persistence.view.CreatableEntityView;
import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.UpdatableEntityView;

import io.debezium.platform.data.model.PipelineEntity;
import io.debezium.platform.domain.views.base.NamedView;
import io.debezium.platform.domain.views.refs.DestinationReference;
import io.debezium.platform.domain.views.refs.SourceReference;
import io.debezium.platform.domain.views.refs.TransformReference;

@EntityView(PipelineEntity.class)
@CreatableEntityView
@UpdatableEntityView
public interface Pipeline extends NamedView {
    String getDescription();

    @NotNull
    SourceReference getSource();

    @NotNull
    DestinationReference getDestination();

    List<TransformReference> getTransforms();

    @NotEmpty
    String getLogLevel();

    void setDescription(String description);

    void setName(String name);

    void setSource(SourceReference source);

    void setDestination(DestinationReference destination);

    void setLogLevel(String logLevel);

    void setTransforms(List<TransformReference> transforms);
}
