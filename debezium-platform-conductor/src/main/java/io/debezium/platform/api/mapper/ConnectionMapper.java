package io.debezium.platform.api.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

import io.debezium.platform.api.dto.ConnectionRequest;
import io.debezium.platform.api.dto.ConnectionResponse;
import io.debezium.platform.domain.views.Connection;

@Mapper(componentModel = "cdi")
public interface ConnectionMapper {
    ConnectionResponse toResponse(Connection view);

    List<ConnectionResponse> toResponseList(List<Connection> views);

    @Mapping(target = "id", ignore = true)
    void applyToView(ConnectionRequest request, @MappingTarget Connection connection);
}
