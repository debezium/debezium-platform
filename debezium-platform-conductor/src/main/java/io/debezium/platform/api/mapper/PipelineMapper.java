/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

import io.debezium.platform.api.dto.NamedRef;
import io.debezium.platform.api.dto.PipelineRequest;
import io.debezium.platform.api.dto.PipelineResponse;
import io.debezium.platform.domain.views.Pipeline;
import io.debezium.platform.domain.views.refs.DestinationReference;
import io.debezium.platform.domain.views.refs.SourceReference;
import io.debezium.platform.domain.views.refs.TransformReference;

@Mapper(componentModel = "cdi")
public abstract class PipelineMapper extends BaseMapper {

    public abstract PipelineResponse toResponse(Pipeline view);

    public abstract List<PipelineResponse> toResponseList(List<Pipeline> views);

    public abstract NamedRef toSourceRef(SourceReference ref);

    public abstract NamedRef toDestRef(DestinationReference ref);

    public abstract NamedRef toTransformRef(TransformReference ref);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "source", ignore = true)
    @Mapping(target = "destination", ignore = true)
    @Mapping(target = "transforms", ignore = true)
    @Mapping(target = "logLevels", ignore = true)
    abstract void applyBasicFields(PipelineRequest request, @MappingTarget Pipeline view);

    public void applyToView(PipelineRequest request, Pipeline view) {
        applyBasicFields(request, view);
        view.setSource(toViewRef(SourceReference.class, request.source()));
        view.setDestination(toViewRef(DestinationReference.class, request.destination()));
        view.setTransforms(toViewRefList(TransformReference.class, request.transforms()));
        if (view.getLogLevels() != null) {
            view.getLogLevels().clear();
        }
        if (request.logLevels() != null && view.getLogLevels() != null) {
            view.getLogLevels().putAll(request.logLevels());
        }
    }
}
