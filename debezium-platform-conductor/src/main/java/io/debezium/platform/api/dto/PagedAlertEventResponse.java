/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.util.List;

public record PagedAlertEventResponse(
        List<AlertEventResponse> events,
        int page,
        int size,
        long totalElements,
        int totalPages) {
}
