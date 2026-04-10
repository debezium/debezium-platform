/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.util.Map;

import io.debezium.platform.data.model.ConnectionEntity;

public record ConnectionResponse(
        Long id,
        String name,
        ConnectionEntity.Type type,
        Map<String, Object> config) {
}
