/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.snapshot;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.debezium.doc.FixFor;

/**
 * Unit tests for parsing the raw notification additional-data map into a {@link ChunkProgressEvent}.
 */
class ChunkProgressEventTest {

    @Test
    @FixFor("debezium/dbz#2536")
    void fromParsesAllFields() {
        Map<String, String> data = Map.of(
                SnapshotNotifications.K_CURRENT_COLLECTION, "inventory.orders",
                SnapshotNotifications.K_CHUNK_INDEX, "3",
                SnapshotNotifications.K_TOTAL_CHUNKS, "6",
                SnapshotNotifications.K_ROWS_SCANNED, "3000");

        ChunkProgressEvent event = ChunkProgressEvent.from(SnapshotNotifications.TABLE_CHUNK_IN_PROGRESS, data);

        assertThat(event.currentTable()).isEqualTo("inventory.orders");
        // chunk_index is 0-based: the fourth chunk is running and three are done.
        assertThat(event.chunkNumber()).isEqualTo(4);
        assertThat(event.completedChunks()).isEqualTo(3);
        assertThat(event.totalChunks()).isEqualTo(6);
        assertThat(event.rowsScanned()).isEqualTo(3000L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void completedChunkCountsItselfWhileARunningOneDoesNot() {
        // Both notifications bracketing a chunk carry the same chunk_index, so the chunk counts as done
        // only on TABLE_CHUNK_COMPLETED. The last chunk of a table is therefore "4 of 4" at 75% while it
        // runs, and reaches 100% when it completes.
        Map<String, String> data = Map.of(
                SnapshotNotifications.K_CURRENT_COLLECTION, "inventory.orders",
                SnapshotNotifications.K_CHUNK_INDEX, "3",
                SnapshotNotifications.K_TOTAL_CHUNKS, "4");

        ChunkProgressEvent running = ChunkProgressEvent.from(SnapshotNotifications.TABLE_CHUNK_IN_PROGRESS, data);
        ChunkProgressEvent completed = ChunkProgressEvent.from(SnapshotNotifications.TABLE_CHUNK_COMPLETED, data);

        assertThat(running.chunkNumber()).isEqualTo(4);
        assertThat(running.completedChunks()).isEqualTo(3);
        assertThat(completed.chunkNumber()).isEqualTo(4);
        assertThat(completed.completedChunks()).isEqualTo(4);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void fromFallsBackToScannedCollectionForTableName() {
        // TABLE_CHUNK_COMPLETED names the table with scanned_collection, unlike the in-progress
        // notifications which use current_collection_in_progress.
        Map<String, String> data = Map.of(
                SnapshotNotifications.K_SCANNED_COLLECTION, "inventory.orders",
                SnapshotNotifications.K_CHUNK_INDEX, "3",
                SnapshotNotifications.K_TOTAL_CHUNKS, "10");

        ChunkProgressEvent event = ChunkProgressEvent.from(SnapshotNotifications.TABLE_CHUNK_COMPLETED, data);

        assertThat(event.currentTable()).isEqualTo("inventory.orders");
        assertThat(event.chunkNumber()).isEqualTo(4);
        assertThat(event.completedChunks()).isEqualTo(4);
        assertThat(event.totalChunks()).isEqualTo(10);
        assertThat(event.rowsScanned()).isNull();
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void fromPrefersCurrentCollectionOverScannedCollection() {
        Map<String, String> data = Map.of(
                SnapshotNotifications.K_CURRENT_COLLECTION, "inventory.orders",
                SnapshotNotifications.K_SCANNED_COLLECTION, "inventory.products");

        assertThat(ChunkProgressEvent.from(SnapshotNotifications.TABLE_CHUNK_IN_PROGRESS, data).currentTable())
                .isEqualTo("inventory.orders");
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void fromReturnsNullsForAbsentEntries() {
        ChunkProgressEvent event = ChunkProgressEvent.from(SnapshotNotifications.TABLE_CHUNK_IN_PROGRESS,
                new HashMap<>());

        assertThat(event.currentTable()).isNull();
        assertThat(event.chunkNumber()).isNull();
        assertThat(event.completedChunks()).isNull();
        assertThat(event.totalChunks()).isNull();
        assertThat(event.rowsScanned()).isNull();
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void fromReturnsNullsForUnparseableNumbers() {
        Map<String, String> data = Map.of(
                SnapshotNotifications.K_CURRENT_COLLECTION, "inventory.orders",
                SnapshotNotifications.K_CHUNK_INDEX, "not-a-number",
                SnapshotNotifications.K_TOTAL_CHUNKS, "  ",
                SnapshotNotifications.K_ROWS_SCANNED, "12.5");

        ChunkProgressEvent event = ChunkProgressEvent.from(SnapshotNotifications.TABLE_CHUNK_IN_PROGRESS, data);

        assertThat(event.currentTable()).isEqualTo("inventory.orders");
        assertThat(event.chunkNumber()).isNull();
        assertThat(event.completedChunks()).isNull();
        assertThat(event.totalChunks()).isNull();
        assertThat(event.rowsScanned()).isNull();
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void fromTrimsSurroundingWhitespaceOnNumbers() {
        Map<String, String> data = Map.of(
                SnapshotNotifications.K_CHUNK_INDEX, " 2 ",
                SnapshotNotifications.K_ROWS_SCANNED, " 1000 ");

        ChunkProgressEvent event = ChunkProgressEvent.from(SnapshotNotifications.TABLE_CHUNK_IN_PROGRESS, data);

        assertThat(event.chunkNumber()).isEqualTo(3);
        assertThat(event.rowsScanned()).isEqualTo(1000L);
    }
}
