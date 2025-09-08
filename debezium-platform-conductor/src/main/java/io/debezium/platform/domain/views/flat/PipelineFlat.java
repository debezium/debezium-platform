/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views.flat;

import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.UpdatableEntityView;
import com.blazebit.persistence.view.UpdatableMapping;

import io.debezium.platform.data.model.PipelineEntity;
import io.debezium.platform.domain.views.Transform;
import io.debezium.platform.domain.views.base.NamedView;

@EntityView(PipelineEntity.class)
@UpdatableEntityView
public interface PipelineFlat extends NamedView {
    String getDescription();

    @NotNull
    SourceFlat getSource();

    @NotNull
    DestinationFlat getDestination();

    @UpdatableMapping
    List<Transform> getTransforms();

    @NotEmpty
    String getDefaultLogLevel();

    Map<String, String> getLogLevels();

    void setDescription(String description);

    void setName(String name);

    void setSource(SourceFlat source);

    void setDestination(DestinationFlat destination);

    void setDefaultLogLevel(String logLevel);

    void setLogLevels(Map<String, String> logLevels);
}
