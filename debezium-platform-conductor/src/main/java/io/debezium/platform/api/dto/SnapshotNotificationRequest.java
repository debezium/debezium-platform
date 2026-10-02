/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.util.Map;

import jakarta.validation.constraints.NotBlank;

/**
 * One Debezium {@code Notification} as delivered by the HTTP notification channel. Mirrors the core
 * notification model (id / aggregateType / type / additionalData / timestamp).
 */
public record SnapshotNotificationRequest(
        @NotBlank String id,
        @NotBlank String aggregateType,
        @NotBlank String type,
        Map<String, String> additionalData,
        Long timestamp) {

    public Map<String, String> additionalData() {
        return additionalData == null ? Map.of() : additionalData;
    }
}
