/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.util.Map;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import io.debezium.platform.data.model.ChannelType;

public record NotificationChannelRequest(
        @NotEmpty String name,
        @NotNull ChannelType type,
        @NotNull Map<String, Object> config,
        Boolean enabled) {
}
