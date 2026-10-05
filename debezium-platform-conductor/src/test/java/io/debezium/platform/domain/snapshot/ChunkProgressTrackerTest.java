/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.snapshot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.HashMap;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.debezium.doc.FixFor;
import io.debezium.platform.api.dto.SnapshotProgressResponse.TableProgress;
import io.debezium.platform.data.model.TableState;
import io.debezium.platform.domain.snapshot.ChunkProgressTracker.RecordOutcome;
import io.debezium.platform.domain.views.ActiveSnapshotTable;

/**
 * Unit tests for the in-memory chunk overlay logic extracted from {@link SnapshotProgressAggregator}.
 * The tracker holds no dependencies, so it is exercised directly.
 */
class ChunkProgressTrackerTest {

    private static final Long PIPELINE_ID = 1L;
    private static final Instant TS = Instant.parse("2026-09-21T10:00:00Z");
    private static final String ORDERS = "inventory.orders";
    private static final String PRODUCTS = "inventory.products";

    private ChunkProgressTracker tracker;

    @BeforeEach
    void setUp() {
        tracker = new ChunkProgressTracker();
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void recordAppliesChunkStateForNewPipeline() {
        RecordOutcome outcome = tracker.record(PIPELINE_ID, event(ORDERS, "2", "10", "2000"), TS);

        assertThat(outcome).isEqualTo(RecordOutcome.FIRST_FOR_TABLE);
        TableProgress progress = tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.IN_PROGRESS, 0L));
        assertThat(progress.progress().chunkNumber()).isEqualTo(3);
        assertThat(progress.rowsScanned()).isEqualTo(2000L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void recordReportsFirstEventPerTableOnlyOnce() {
        // The first event for a table is the structural one; callers persist it eagerly and throttle
        // the rest, so the two cases must be distinguishable per table rather than per pipeline.
        assertThat(tracker.record(PIPELINE_ID, event(ORDERS, "1", "10", "1000"), TS))
                .isEqualTo(RecordOutcome.FIRST_FOR_TABLE);
        assertThat(tracker.record(PIPELINE_ID, event(ORDERS, "2", "10", "2000"), TS.plusSeconds(1)))
                .isEqualTo(RecordOutcome.UPDATED);
        assertThat(tracker.record(PIPELINE_ID, event(PRODUCTS, "1", "4", "500"), TS.plusSeconds(2)))
                .isEqualTo(RecordOutcome.FIRST_FOR_TABLE);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void recordIgnoresEventOlderThanTheLatestSeen() {
        tracker.record(PIPELINE_ID, event(ORDERS, "3", "10", "5000"), TS);

        RecordOutcome outcome = tracker.record(PIPELINE_ID, event(ORDERS, "1", "10", "1000"), TS.minusSeconds(30));

        assertThat(outcome).isEqualTo(RecordOutcome.STALE);
        // The stale event must not overwrite the newer overlay.
        assertThat(tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.IN_PROGRESS, 0L)).rowsScanned())
                .isEqualTo(5000L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void tracksEachTableIndependently() {
        tracker.record(PIPELINE_ID, event(ORDERS, null, null, "5000"), TS);
        // A second table reporting no row count must not inherit the first table's total.
        tracker.record(PIPELINE_ID, event(PRODUCTS, null, null, null), TS.plusSeconds(1));

        assertThat(tracker.toTableProgress(PIPELINE_ID, mockTable(PRODUCTS, TableState.IN_PROGRESS, 0L)).rowsScanned())
                .isZero();
        // ...and the first table keeps its own live count.
        assertThat(tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.IN_PROGRESS, 0L)).rowsScanned())
                .isEqualTo(5000L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void tracksMultipleInProgressTablesConcurrently() {
        // Parallel snapshot (snapshot.max.threads > 1): chunk events for two tables interleave and
        // each must keep its own live progress.
        tracker.record(PIPELINE_ID, event(ORDERS, "2", "10", "2000"), TS);
        tracker.record(PIPELINE_ID, event(PRODUCTS, "5", "8", "4000"), TS.plusSeconds(1));
        tracker.record(PIPELINE_ID, event(ORDERS, "3", "10", "3000"), TS.plusSeconds(2));

        TableProgress orders = tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.IN_PROGRESS, 0L));
        TableProgress products = tracker.toTableProgress(PIPELINE_ID, mockTable(PRODUCTS, TableState.IN_PROGRESS, 0L));

        assertThat(orders.progress().chunkNumber()).isEqualTo(4);
        assertThat(orders.rowsScanned()).isEqualTo(3000L);
        assertThat(products.progress().chunkNumber()).isEqualTo(6);
        assertThat(products.rowsScanned()).isEqualTo(4000L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void recordKeepsLastKnownRowCountWhenTableReportsNoRows() {
        tracker.record(PIPELINE_ID, event(ORDERS, "1", "10", "5000"), TS);
        // A later event for the same table without a row count keeps the last known value.
        tracker.record(PIPELINE_ID, event(ORDERS, "2", "10", null), TS.plusSeconds(1));

        assertThat(tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.IN_PROGRESS, 0L)).rowsScanned())
                .isEqualTo(5000L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void toTableProgressMergesOverlayOntoCurrentTable() {
        tracker.record(PIPELINE_ID, event(ORDERS, "3", "6", "3000"), TS);

        TableProgress progress = tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.IN_PROGRESS, 100L));

        assertThat(progress.name()).isEqualTo(ORDERS);
        assertThat(progress.progress().chunkNumber()).isEqualTo(4);
        assertThat(progress.progress().totalChunks()).isEqualTo(6);
        assertThat(progress.progress().percentage()).isEqualTo(50.0);
        // Live overlay row count wins over the (stale) persisted value.
        assertThat(progress.rowsScanned()).isEqualTo(3000L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void lastChunkReachesHundredPercentOnlyOnceItCompletes() {
        // The two notifications of the last chunk carry the same 0-based index, so the bar stays at
        // 75% while that chunk is scanned and only fills up when its completion arrives.
        tracker.record(PIPELINE_ID, event(ORDERS, "3", "4", "3000"), TS);
        assertThat(tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.IN_PROGRESS, 0L)).progress())
                .satisfies(progress -> {
                    assertThat(progress.chunkNumber()).isEqualTo(4);
                    assertThat(progress.percentage()).isEqualTo(75.0);
                });

        tracker.record(PIPELINE_ID,
                event(SnapshotNotifications.TABLE_CHUNK_COMPLETED, ORDERS, "3", "4", null), TS.plusSeconds(1));

        assertThat(tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.IN_PROGRESS, 0L)).progress())
                .satisfies(progress -> {
                    assertThat(progress.chunkNumber()).isEqualTo(4);
                    assertThat(progress.percentage()).isEqualTo(100.0);
                });
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void toTableProgressCapsChunkPercentageAtHundred() {
        tracker.record(PIPELINE_ID, event(ORDERS, "10", "6", "1000"), TS);

        TableProgress progress = tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.IN_PROGRESS, 0L));

        assertThat(progress.progress().percentage()).isEqualTo(100.0);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void toTableProgressLeavesNonCurrentTableUntouched() {
        tracker.record(PIPELINE_ID, event(ORDERS, "3", "6", "3000"), TS);

        TableProgress progress = tracker.toTableProgress(PIPELINE_ID, mockTable(PRODUCTS, TableState.COMPLETED, 999L));

        assertThat(progress.progress()).isNull();
        assertThat(progress.rowsScanned()).isEqualTo(999L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void toTableProgressWithoutOverlayReturnsPersistedRow() {
        TableProgress progress = tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.IN_PROGRESS, 42L));

        assertThat(progress.progress()).isNull();
        assertThat(progress.rowsScanned()).isEqualTo(42L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void latestUpdateReturnsOverlayTimestampWhenNewer() {
        tracker.record(PIPELINE_ID, event(ORDERS, "1", "6", "100"), TS.plusSeconds(60));

        assertThat(tracker.latestUpdate(PIPELINE_ID, TS)).isEqualTo(TS.plusSeconds(60));
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void latestUpdateReturnsPersistedWhenNewerOrNoOverlay() {
        assertThat(tracker.latestUpdate(PIPELINE_ID, TS)).isEqualTo(TS);

        tracker.record(PIPELINE_ID, event(ORDERS, "1", "6", "100"), TS.minusSeconds(60));
        assertThat(tracker.latestUpdate(PIPELINE_ID, TS)).isEqualTo(TS);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void completeTableClearsOverlayForMatchingTable() {
        tracker.record(PIPELINE_ID, event(ORDERS, "3", "6", "3000"), TS);

        tracker.completeTable(PIPELINE_ID, ORDERS);

        // With the overlay gone, the persisted row wins and no chunk progress is attached.
        TableProgress progress = tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.COMPLETED, 5000L));
        assertThat(progress.progress()).isNull();
        assertThat(progress.rowsScanned()).isEqualTo(5000L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void overlayIsIgnoredOnceTheTableReachedATerminalState() {
        // A chunk event can still arrive after the table was completed (a retried notification), which
        // re-creates its overlay; the finished table must keep its final persisted values.
        tracker.record(PIPELINE_ID, event(ORDERS, "3", "6", "3000"), TS);

        TableProgress progress = tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.COMPLETED, 5000L));

        assertThat(progress.progress()).isNull();
        assertThat(progress.rowsScanned()).isEqualTo(5000L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void completeTableKeepsOverlayForDifferentTable() {
        tracker.record(PIPELINE_ID, event(ORDERS, "3", "6", "3000"), TS);

        tracker.completeTable(PIPELINE_ID, PRODUCTS);

        // The overlay for the still-running table survives, so it keeps merging onto it.
        TableProgress progress = tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.IN_PROGRESS, 0L));
        assertThat(progress.progress().chunkNumber()).isEqualTo(4);
        assertThat(progress.rowsScanned()).isEqualTo(3000L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void clearRemovesOverlay() {
        tracker.record(PIPELINE_ID, event(ORDERS, "3", "6", "3000"), TS);

        tracker.clear(PIPELINE_ID);

        // With the overlay gone, nothing is merged: the persisted row wins and no chunk is attached.
        TableProgress progress = tracker.toTableProgress(PIPELINE_ID, mockTable(ORDERS, TableState.IN_PROGRESS, 42L));
        assertThat(progress.progress()).isNull();
        assertThat(progress.rowsScanned()).isEqualTo(42L);
    }

    private static ChunkProgressEvent event(String currentTable, String chunkIndex, String totalChunks, String rows) {
        return event(SnapshotNotifications.TABLE_CHUNK_IN_PROGRESS, currentTable, chunkIndex, totalChunks, rows);
    }

    private static ChunkProgressEvent event(String notificationType, String currentTable, String chunkIndex,
                                            String totalChunks, String rows) {
        HashMap<String, String> data = new HashMap<>();
        if (currentTable != null) {
            data.put(SnapshotNotifications.K_CURRENT_COLLECTION, currentTable);
        }
        if (chunkIndex != null) {
            data.put(SnapshotNotifications.K_CHUNK_INDEX, chunkIndex);
        }
        if (totalChunks != null) {
            data.put(SnapshotNotifications.K_TOTAL_CHUNKS, totalChunks);
        }
        if (rows != null) {
            data.put(SnapshotNotifications.K_ROWS_SCANNED, rows);
        }
        return ChunkProgressEvent.from(notificationType, data);
    }

    private static ActiveSnapshotTable mockTable(String name, TableState state, long rowsScanned) {
        ActiveSnapshotTable table = mock(ActiveSnapshotTable.class);
        when(table.getTableName()).thenReturn(name);
        when(table.getState()).thenReturn(state);
        when(table.getRowsScanned()).thenReturn(rowsScanned);
        return table;
    }
}
