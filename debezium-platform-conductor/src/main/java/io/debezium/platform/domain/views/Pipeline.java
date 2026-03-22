/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.blazebit.persistence.view.CreatableEntityView;
import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.Mapping;
import com.blazebit.persistence.view.UpdatableEntityView;

import io.debezium.platform.data.model.PipelineEntity;
import io.debezium.platform.domain.views.base.NamedView;
import io.debezium.platform.domain.views.refs.DestinationReference;
import io.debezium.platform.domain.views.refs.SourceReference;
import io.debezium.platform.domain.views.refs.TransformReference;
import io.debezium.platform.validation.ValidationPatterns;

@EntityView(PipelineEntity.class)
@CreatableEntityView
@UpdatableEntityView
public interface Pipeline extends NamedView {
    @Override
    @NotEmpty
    @Size(max = 253, message = "Pipeline name must be 253 characters or fewer")
    @Pattern(regexp = ValidationPatterns.RFC_1123_SUBDOMAIN, message = "Pipeline name must be a lowercase RFC 1123 subdomain")
    String getName();

    String getDescription();

    @NotNull
    SourceReference getSource();

    @NotNull
    DestinationReference getDestination();

    List<TransformReference> getTransforms();

    @NotEmpty
    @Mapping("defaultLogLevel")
    String getLogLevel();

    Map<String, String> getLogLevels();

    void setDescription(String description);

    void setName(String name);

    void setSource(SourceReference source);

    void setDestination(DestinationReference destination);

    void setLogLevel(String logLevel);

    void setLogLevels(Map<String, String> logLevels);

    void setTransforms(List<TransformReference> transforms);
}
