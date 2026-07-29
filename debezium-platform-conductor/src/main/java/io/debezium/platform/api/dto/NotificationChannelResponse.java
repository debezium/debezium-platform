/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.time.Instant;
import java.util.Map;

import io.debezium.platform.data.model.ChannelType;

public record NotificationChannelResponse(
        Long id,
        String name,
        ChannelType type,
        Map<String, Object> config,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt) {
}
