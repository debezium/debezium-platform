/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.mapper;

import java.time.Duration;
import java.time.Instant;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import io.debezium.platform.api.dto.AlertEventResponse;
import io.debezium.platform.domain.views.AlertEvent;

@Mapper(componentModel = "cdi")
public interface AlertEventMapper {

    @Mapping(target = "status", expression = "java(status(view))")
    @Mapping(target = "durationSeconds", expression = "java(durationSeconds(view))")
    AlertEventResponse toResponse(AlertEvent view);

    default String status(AlertEvent view) {
        return view.getResolvedAt() == null ? "firing" : "resolved";
    }

    default Long durationSeconds(AlertEvent view) {
        Instant end = view.getResolvedAt() != null ? view.getResolvedAt() : Instant.now();
        return Duration.between(view.getFiredAt(), end).toSeconds();
    }
}