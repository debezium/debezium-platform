/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.util.Map;
import java.util.Set;

import jakarta.validation.constraints.NotEmpty;

public record DestinationRequest(
        @NotEmpty String name,
        String description,
        @NotEmpty String type,
        @NotEmpty String schema,
        NamedRef connection,
        Set<NamedRef> vaults,
        Map<String, Object> config) {
}
