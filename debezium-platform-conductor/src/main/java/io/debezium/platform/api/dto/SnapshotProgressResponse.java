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
 * Full snapshot progress aggregate. This is both the SSE event payload (event name
 * {@code snapshot-progress}) and the body of the one-shot progress endpoint. Every SSE event
 * carries the complete state (never a delta), so the UI renders by replacing its state.
 * <p>
 * When no snapshot is active the IDLE payload is returned: {@code type = null},
 * {@code status = IDLE}, {@code globalProgress = null}, {@code tables = []}.
 */
public record SnapshotProgressResponse(
        SnapshotType type,
        SnapshotState status,
        GlobalProgress globalProgress,
        List<TableProgress> tables,
        Instant startedAt,
        Instant lastUpdatedAt,
        Long elapsedSeconds,
        long totalRowsScanned) {

    public record GlobalProgress(int totalTables, int completedTables, double percentage) {
    }

    public record TableProgress(
            String name,
            TableState status,
            ChunkProgress progress,
            long rowsScanned,
            String skipReason) {

        public record ChunkProgress(int chunkIndex, int totalChunks, double percentage) {
        }
    }

    public static SnapshotProgressResponse idle() {
        return new SnapshotProgressResponse(null, SnapshotState.IDLE, null, List.of(), null, null, null, 0L);
    }
}
