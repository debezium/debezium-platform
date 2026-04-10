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
import io.debezium.platform.api.dto.SourceRequest;
import io.debezium.platform.api.dto.SourceResponse;
import io.debezium.platform.domain.views.Source;
import io.debezium.platform.domain.views.refs.ConnectionReference;
import io.debezium.platform.domain.views.refs.VaultReference;

@Mapper(componentModel = "cdi")
public abstract class SourceMapper extends BaseMapper {

    public abstract SourceResponse toResponse(Source view);

    public abstract List<SourceResponse> toResponseList(List<Source> views);

    public abstract NamedRef toRef(ConnectionReference ref);

    public abstract NamedRef vaultToRef(VaultReference ref);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "connection", ignore = true)
    @Mapping(target = "vaults", ignore = true)
    abstract void applyBasicFields(SourceRequest request, @MappingTarget Source view);

    public void applyToView(SourceRequest request, Source view) {
        applyBasicFields(request, view);
        view.setConnection(toViewRef(ConnectionReference.class, request.connection()));
        view.setVaults(toViewRefSet(VaultReference.class, request.vaults()));
    }
}
