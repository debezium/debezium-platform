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

import io.debezium.platform.api.dto.DestinationRequest;
import io.debezium.platform.api.dto.DestinationResponse;
import io.debezium.platform.api.dto.NamedRef;
import io.debezium.platform.domain.views.Destination;
import io.debezium.platform.domain.views.refs.ConnectionReference;
import io.debezium.platform.domain.views.refs.VaultReference;

@Mapper(componentModel = "cdi")
public abstract class DestinationMapper extends BaseMapper {

    public abstract DestinationResponse toResponse(Destination view);

    public abstract List<DestinationResponse> toResponseList(List<Destination> views);

    public abstract NamedRef toRef(ConnectionReference ref);

    public abstract NamedRef vaultToRef(VaultReference ref);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "connection", ignore = true)
    @Mapping(target = "vaults", ignore = true)
    abstract void applyBasicFields(DestinationRequest request, @MappingTarget Destination view);

    public void applyToView(DestinationRequest request, Destination view) {
        applyBasicFields(request, view);
        view.setConnection(toViewRef(ConnectionReference.class, request.connection()));
        view.setVaults(toViewRefSet(VaultReference.class, request.vaults()));
    }
}
