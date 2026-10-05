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
 * The wire field {@code chunk_index} is 0-based and carries the <em>same</em> value on the two
 * notifications that bracket one chunk, so it is split here into the two numbers the view needs:
 * {@link #chunkNumber()}, the 1-based chunk being worked on (what a UI labels "chunk 2 of 6"), and
 * {@link #completedChunks()}, how many chunks are actually done (what the percentage is computed
 * from). The chunk only counts as done on {@code TABLE_CHUNK_COMPLETED}, hence the notification type.
 * <p>
 * Each field is {@code null} when its additional-data entry is absent or unparseable; the tracker
 * decides how a {@code null} row count folds onto the previous value.
 */
record ChunkProgressEvent(String currentTable, Integer chunkNumber, Integer completedChunks,
        Integer totalChunks, Long rowsScanned) {

    static ChunkProgressEvent from(String notificationType, Map<String, String> data) {
        Integer chunkIndex = parseIntOrNull(data.get(K_CHUNK_INDEX));
        boolean chunkIsDone = SnapshotNotifications.TABLE_CHUNK_COMPLETED.equals(notificationType);
        return new ChunkProgressEvent(
                tableOf(data),
                chunkIndex == null ? null : chunkIndex + 1,
                chunkIndex == null ? null : (chunkIsDone ? chunkIndex + 1 : chunkIndex),
                parseIntOrNull(data.get(K_TOTAL_CHUNKS)),
                parseLongOrNull(data.get(K_ROWS_SCANNED)));
    }

    /**
     * The table the chunk belongs to, or {@code null} when the notification names none. The in-progress
     * notifications name it with {@code current_collection_in_progress} while
     * {@code TABLE_CHUNK_COMPLETED} uses {@code scanned_collection}, so both spellings are accepted.
     * A blank value counts as absent in either spelling, so it never reaches the overlay or the active
     * row as an empty table name.
     */
    private static String tableOf(Map<String, String> data) {
        String currentCollection = data.get(K_CURRENT_COLLECTION);
        if (!Strings.isNullOrBlank(currentCollection)) {
            return currentCollection;
        }
        String scannedCollection = data.get(K_SCANNED_COLLECTION);
        return Strings.isNullOrBlank(scannedCollection) ? null : scannedCollection;
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
