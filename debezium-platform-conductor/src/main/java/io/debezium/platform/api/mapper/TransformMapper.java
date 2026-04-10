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
import io.debezium.platform.api.dto.PredicateDto;
import io.debezium.platform.api.dto.TransformRequest;
import io.debezium.platform.api.dto.TransformResponse;
import io.debezium.platform.domain.views.Predicate;
import io.debezium.platform.domain.views.Transform;
import io.debezium.platform.domain.views.refs.VaultReference;

@Mapper(componentModel = "cdi")
public abstract class TransformMapper extends BaseMapper {

    public abstract TransformResponse toResponse(Transform view);

    public abstract List<TransformResponse> toResponseList(List<Transform> views);

    public abstract NamedRef vaultToRef(VaultReference ref);

    public abstract PredicateDto predicateToDto(Predicate predicate);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "vaults", ignore = true)
    @Mapping(target = "predicate", ignore = true)
    abstract void applyBasicFields(TransformRequest request, @MappingTarget Transform view);

    public void applyToView(TransformRequest request, Transform view) {
        applyBasicFields(request, view);
        if (request.vaults() != null) {
            view.setVaults(toViewRefSet(VaultReference.class, request.vaults()));
        }
        if (request.predicate() != null) {
            Predicate pred = view.getPredicate() != null ? view.getPredicate() : evm.create(Predicate.class);
            pred.setType(request.predicate().type());
            pred.setConfig(request.predicate().config());
            pred.setNegate(request.predicate().negate());
            view.setPredicate(pred);
        }
    }
}
