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

import io.debezium.platform.api.dto.NotificationChannelRequest;
import io.debezium.platform.api.dto.NotificationChannelResponse;
import io.debezium.platform.domain.views.NotificationChannel;

@Mapper(componentModel = "cdi")
public interface NotificationChannelMapper {

    NotificationChannelResponse toResponse(NotificationChannel view);

    List<NotificationChannelResponse> toResponseList(List<NotificationChannel> views);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    void applyToView(NotificationChannelRequest request, @MappingTarget NotificationChannel view);
}
