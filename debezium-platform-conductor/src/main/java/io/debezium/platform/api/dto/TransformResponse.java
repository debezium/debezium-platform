/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonInclude;

public record TransformResponse(
        Long id,
        String name,
        String description,
        String type,
        String schema,
        Set<NamedRef> vaults,
        Map<String, Object> config,
        @JsonInclude(JsonInclude.Include.NON_NULL) PredicateDto predicate) {
}
