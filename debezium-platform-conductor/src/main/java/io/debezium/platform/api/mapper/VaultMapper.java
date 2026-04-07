package io.debezium.platform.api.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

import io.debezium.platform.api.dto.VaultRequest;
import io.debezium.platform.api.dto.VaultResponse;
import io.debezium.platform.domain.views.Vault;

@Mapper(componentModel = "cdi")
public interface VaultMapper {
    VaultResponse toResponse(Vault view);

    List<VaultResponse> toResponseList(List<Vault> views);

    @Mapping(target = "id", ignore = true)
    void applyToView(VaultRequest request, @MappingTarget Vault view);
}
