/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.snapshot;

import static io.debezium.platform.domain.snapshot.SnapshotNotifications.K_CHUNK_INDEX;
import static io.debezium.platform.domain.snapshot.SnapshotNotifications.K_CURRENT_COLLECTION;
import static io.debezium.platform.domain.snapshot.SnapshotNotifications.K_ROWS_SCANNED;
import static io.debezium.platform.domain.snapshot.SnapshotNotifications.K_SCANNED_COLLECTION;
import static io.debezium.platform.domain.snapshot.SnapshotNotifications.K_TOTAL_CHUNKS;

import java.util.Map;

import io.debezium.util.Strings;

/**
 * The parsed chunk-progress payload of a snapshot {@code IN_PROGRESS} / {@code TABLE_CHUNK_IN_PROGRESS}
 * / {@code TABLE_CHUNK_COMPLETED} notification (DDD-68). Built once from the raw {@code additionalData}
 * map so both the caller (which needs {@link #currentTable()} to mark the table in progress) and
 * {@link ChunkProgressTracker} (which folds it onto the running overlay) read typed fields instead of
 * re-parsing the map.
 * <p>
 * Each field is {@code null} when its additional-data entry is absent or unparseable; the tracker
 * decides how a {@code null} row count folds onto the previous value.
 */
record ChunkProgressEvent(String currentTable, Integer chunkIndex, Integer totalChunks, Long rowsScanned) {

    static ChunkProgressEvent from(Map<String, String> data) {
        return new ChunkProgressEvent(
                tableOf(data),
                parseIntOrNull(data.get(K_CHUNK_INDEX)),
                parseIntOrNull(data.get(K_TOTAL_CHUNKS)),
                parseLongOrNull(data.get(K_ROWS_SCANNED)));
    }

    /**
     * The table the chunk belongs to. The in-progress notifications name it with
     * {@code current_collection_in_progress} while {@code TABLE_CHUNK_COMPLETED} uses
     * {@code scanned_collection}, so both spellings are accepted.
     */
    private static String tableOf(Map<String, String> data) {
        String currentCollection = data.get(K_CURRENT_COLLECTION);
        return Strings.isNullOrBlank(currentCollection) ? data.get(K_SCANNED_COLLECTION) : currentCollection;
    }

    private static Integer parseIntOrNull(String value) {
        if (Strings.isNullOrBlank(value)) {
            return null;
        }
        try {
            return Integer.parseInt(value.trim());
        }
        catch (NumberFormatException e) {
            return null;
        }
    }

    private static Long parseLongOrNull(String value) {
        if (Strings.isNullOrBlank(value)) {
            return null;
        }
        try {
            return Long.parseLong(value.trim());
        }
        catch (NumberFormatException e) {
            return null;
        }
    }
}
