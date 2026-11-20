/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.util.List;
import java.util.Map;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

import io.debezium.connector.SnapshotType;
import io.debezium.platform.data.model.PipelineStatus;
import io.debezium.platform.data.model.SnapshotState;

public record PipelineResponse(
        Long id,
        String name,
        String description,
        NamedRef source,
        NamedRef destination,
        List<NamedRef> transforms,
        String logLevel,
        Map<String, String> logLevels,
        PipelineStatus status,
        String errorMessage,
        @Schema(nullable = true) SnapshotType activeSnapshotType,
        @Schema(nullable = true) SnapshotState activeSnapshotStatus) {

    public PipelineResponse(Long id, String name, String description, NamedRef source, NamedRef destination,
                            List<NamedRef> transforms, String logLevel, Map<String, String> logLevels,
                            PipelineStatus status, String errorMessage) {
        this(id, name, description, source, destination, transforms, logLevel, logLevels, status, errorMessage, null, null);
    }
}
