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

        ChunkProgressEvent event = ChunkProgressEvent.from(data);

        assertThat(event.currentTable()).isEqualTo("inventory.orders");
        assertThat(event.chunkIndex()).isEqualTo(3);
        assertThat(event.totalChunks()).isEqualTo(6);
        assertThat(event.rowsScanned()).isEqualTo(3000L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void fromReturnsNullsForAbsentEntries() {
        ChunkProgressEvent event = ChunkProgressEvent.from(new HashMap<>());

        assertThat(event.currentTable()).isNull();
        assertThat(event.chunkIndex()).isNull();
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

        ChunkProgressEvent event = ChunkProgressEvent.from(data);

        assertThat(event.currentTable()).isEqualTo("inventory.orders");
        assertThat(event.chunkIndex()).isNull();
        assertThat(event.totalChunks()).isNull();
        assertThat(event.rowsScanned()).isNull();
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void fromTrimsSurroundingWhitespaceOnNumbers() {
        Map<String, String> data = Map.of(
                SnapshotNotifications.K_CHUNK_INDEX, " 2 ",
                SnapshotNotifications.K_ROWS_SCANNED, " 1000 ");

        ChunkProgressEvent event = ChunkProgressEvent.from(data);

        assertThat(event.chunkIndex()).isEqualTo(2);
        assertThat(event.rowsScanned()).isEqualTo(1000L);
    }
}
