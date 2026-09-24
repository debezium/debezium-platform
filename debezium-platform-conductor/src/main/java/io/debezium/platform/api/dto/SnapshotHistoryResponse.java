/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.time.Instant;
import java.util.List;

import io.debezium.connector.SnapshotType;
import io.debezium.platform.data.model.SnapshotState;
import io.debezium.platform.data.model.TableState;

/**
 * A completed snapshot run. {@code tables} is populated only by the single-run detail endpoint; in
 * the paginated list it is {@code null}/empty to keep the payload light.
 */
public record SnapshotHistoryResponse(
        Long id,
        Long pipelineId,
        String pipelineName,
        SnapshotType type,
        SnapshotState outcome,
        int totalTables,
        int completedTables,
        long totalRowsScanned,
        Instant startedAt,
        Instant completedAt,
        long durationSeconds,
        List<TableHistoryEntry> tables) {

    public record TableHistoryEntry(
            String tableName,
            TableState outcome,
            long rowsScanned,
            String skipReason,
            Long durationSeconds) {
    }
}
