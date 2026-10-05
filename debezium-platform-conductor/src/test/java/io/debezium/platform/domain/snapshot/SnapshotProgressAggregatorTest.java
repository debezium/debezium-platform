/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.snapshot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import io.debezium.connector.SnapshotType;
import io.debezium.doc.FixFor;
import io.debezium.platform.api.dto.SnapshotNotificationRequest;
import io.debezium.platform.api.dto.SnapshotProgressResponse;
import io.debezium.platform.config.SnapshotMonitoringConfigGroup;
import io.debezium.platform.data.model.SnapshotState;
import io.debezium.platform.data.model.TableState;
import io.debezium.platform.domain.ActiveSnapshotService;
import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.domain.SnapshotHistoryService;
import io.debezium.platform.domain.views.ActiveSnapshot;
import io.debezium.platform.domain.views.ActiveSnapshotTable;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SnapshotProgressAggregatorTest {

    private static final Long PIPELINE_ID = 1L;
    private static final Instant TS = Instant.parse("2026-09-21T10:00:00Z");
    private static final Duration HEARTBEAT = Duration.ofSeconds(30);
    private static final Duration DEBOUNCE = Duration.ofSeconds(1);

    @Mock
    ActiveSnapshotService activeService;

    @Mock
    SnapshotHistoryService historyService;

    @Mock
    PipelineService pipelineService;

    @Mock
    SnapshotMonitoringConfigGroup config;

    @Mock
    SnapshotMonitoringConfigGroup.WatchdogConfigGroup watchdog;

    @Mock
    SnapshotMonitoringConfigGroup.SseConfigGroup sse;

    SnapshotProgressAggregator aggregator;

    @BeforeEach
    void setUp() {
        when(config.watchdog()).thenReturn(watchdog);
        when(watchdog.heartbeat()).thenReturn(HEARTBEAT);
        when(config.sse()).thenReturn(sse);
        when(sse.debounce()).thenReturn(DEBOUNCE);
        aggregator = new SnapshotProgressAggregator(activeService, historyService, pipelineService, config);
        // Unstubbed Optional-returning mocks default to Optional.empty(); individual tests that need an
        // active snapshot stub activeService.find(...) explicitly.
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void startedCreatesActiveSnapshotWithReportedTables() {
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INCREMENTAL, SnapshotNotifications.STARTED,
                Map.of(SnapshotNotifications.K_DATA_COLLECTIONS, "[inventory.orders, inventory.products]")));

        verify(activeService).create(eq(PIPELINE_ID), eq(SnapshotType.INCREMENTAL), any(),
                eq(List.of("inventory.orders", "inventory.products")), eq(TS));
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void initialStartedWithoutTablesCreatesEmptyActiveSnapshot() {
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.STARTED,
                Map.of()));

        verify(activeService).create(eq(PIPELINE_ID), eq(SnapshotType.INITIAL), any(), eq(List.of()), eq(TS));
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void startedWhileActiveClosesPreviousRunAsAborted() {
        ActiveSnapshot active = mockActive(SnapshotState.RUNNING);
        when(activeService.find(PIPELINE_ID)).thenReturn(Optional.of(active));
        when(pipelineService.findById(PIPELINE_ID)).thenReturn(Optional.empty());

        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.STARTED,
                Map.of()));

        verify(historyService).closeAsAborted(eq(PIPELINE_ID), any(), eq(TS));
        verify(activeService).create(eq(PIPELINE_ID), eq(SnapshotType.INITIAL), any(), any(), eq(TS));
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void dataCollectionsResolvedRegistersFullTableSet() {
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL,
                SnapshotNotifications.DATA_COLLECTIONS_RESOLVED,
                Map.of(SnapshotNotifications.K_DATA_COLLECTIONS,
                        "inventory.bigtable,inventory.customers,inventory.orders")));

        verify(activeService).registerTables(PIPELINE_ID,
                List.of("inventory.bigtable", "inventory.customers", "inventory.orders"), TS);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void chunkProgressMarksCurrentTableInProgress() {
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.IN_PROGRESS,
                Map.of(SnapshotNotifications.K_CURRENT_COLLECTION, "inventory.orders",
                        SnapshotNotifications.K_CHUNK_INDEX, "2",
                        SnapshotNotifications.K_TOTAL_CHUNKS, "10",
                        SnapshotNotifications.K_ROWS_SCANNED, "2000")));

        verify(activeService).markInProgress(PIPELINE_ID, "inventory.orders", TS);
        verify(activeService, never()).completeTable(anyLong(), any(), any(), anyLong(), any(), any());
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void tableChunkCompletedDoesNotCompleteTheTable() {
        // TABLE_CHUNK_COMPLETED reports that one slice finished, not the whole table, and it names the
        // table with scanned_collection rather than current_collection_in_progress. Treating it as a
        // table completion would mark the table terminal (with rowsScanned 0) after its first chunk.
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.TABLE_CHUNK_COMPLETED,
                Map.of(SnapshotNotifications.K_SCANNED_COLLECTION, "inventory.orders",
                        SnapshotNotifications.K_CHUNK_INDEX, "3",
                        SnapshotNotifications.K_TOTAL_CHUNKS, "10",
                        SnapshotNotifications.K_STATUS, "SUCCEEDED")));

        verify(activeService).markInProgress(PIPELINE_ID, "inventory.orders", TS);
        verify(activeService, never()).completeTable(anyLong(), any(), any(), anyLong(), any(), any());
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void repeatedChunkProgressWithinHeartbeatIsPersistedOnce() {
        // Chunk events arrive at a high rate and all of a pipeline's snapshot threads write the same
        // active_snapshot row; only the first one and a periodic heartbeat have to reach the database.
        chunkProgressAt("inventory.orders", TS);
        chunkProgressAt("inventory.orders", TS.plusSeconds(1));
        chunkProgressAt("inventory.orders", TS.plus(HEARTBEAT).minusSeconds(1));

        verify(activeService, times(1)).markInProgress(eq(PIPELINE_ID), eq("inventory.orders"), any());
        verify(activeService).markInProgress(PIPELINE_ID, "inventory.orders", TS);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void firstChunkProgressOfEachTableIsPersistedEvenWithinHeartbeat() {
        // The first event for a table is structural (it creates the row and moves it to IN_PROGRESS), so
        // the throttle must never swallow it, however close it is to the previous table's.
        chunkProgressAt("inventory.orders", TS);
        chunkProgressAt("inventory.products", TS.plusSeconds(1));

        verify(activeService).markInProgress(PIPELINE_ID, "inventory.orders", TS);
        verify(activeService).markInProgress(PIPELINE_ID, "inventory.products", TS.plusSeconds(1));
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void chunkProgressIsPersistedAgainOnceHeartbeatElapses() {
        // A long single-table scan must keep refreshing last_updated_at, or the staleness watchdog would
        // flag a snapshot that is simply still scanning.
        chunkProgressAt("inventory.orders", TS);
        chunkProgressAt("inventory.orders", TS.plusSeconds(10));
        chunkProgressAt("inventory.orders", TS.plus(HEARTBEAT));

        verify(activeService, times(2)).markInProgress(eq(PIPELINE_ID), eq("inventory.orders"), any());
        verify(activeService).markInProgress(PIPELINE_ID, "inventory.orders", TS);
        verify(activeService).markInProgress(PIPELINE_ID, "inventory.orders", TS.plus(HEARTBEAT));
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void chunkProgressTimestampFromTheFutureDoesNotWedgeTheHeartbeat() {
        // The heartbeat compares notification timestamps, which are per-table and can cross: a single
        // event from the future must not suppress another table's writes until event time catches up.
        chunkProgressAt("inventory.orders", TS);
        chunkProgressAt("inventory.products", TS.plusSeconds(1));
        chunkProgressAt("inventory.orders", TS.plus(Duration.ofHours(2)));

        chunkProgressAt("inventory.products", TS.plusSeconds(2));

        verify(activeService).markInProgress(PIPELINE_ID, "inventory.products", TS.plusSeconds(2));
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void chunkProgressWithoutTableNameIsIgnored() {
        // Nothing can be attributed to a table, so neither the overlay nor the active row is touched and
        // the event must not count as a heartbeat write for the next real one.
        aggregator.accept(PIPELINE_ID, notificationAt(SnapshotNotifications.AGG_INITIAL,
                SnapshotNotifications.TABLE_CHUNK_IN_PROGRESS,
                Map.of(SnapshotNotifications.K_ROWS_SCANNED, "1000"), TS.toEpochMilli()));
        chunkProgressAt("inventory.orders", TS.plusSeconds(1));

        verify(activeService, times(1)).markInProgress(anyLong(), any(), any());
        verify(activeService).markInProgress(PIPELINE_ID, "inventory.orders", TS.plusSeconds(1));
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void tableScanSucceededMapsToCompleted() {
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.TABLE_SCAN_COMPLETED,
                Map.of(SnapshotNotifications.K_SCANNED_COLLECTION, "inventory.orders",
                        SnapshotNotifications.K_ROWS_SCANNED, "5000",
                        SnapshotNotifications.K_STATUS, "SUCCEEDED")));

        verify(activeService).completeTable(PIPELINE_ID, "inventory.orders", TableState.COMPLETED, 5000L, null, TS);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void tableScanEmptyMapsToSkippedWithReason() {
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.TABLE_SCAN_COMPLETED,
                Map.of(SnapshotNotifications.K_SCANNED_COLLECTION, "inventory.audit",
                        SnapshotNotifications.K_STATUS, "EMPTY")));

        verify(activeService).completeTable(PIPELINE_ID, "inventory.audit", TableState.SKIPPED, 0L, "Table is empty", TS);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void tableScanSqlExceptionMapsToFailed() {
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.TABLE_SCAN_COMPLETED,
                Map.of(SnapshotNotifications.K_SCANNED_COLLECTION, "inventory.orders",
                        SnapshotNotifications.K_STATUS, "SQL_EXCEPTION")));

        verify(activeService).completeTable(PIPELINE_ID, "inventory.orders", TableState.FAILED, 0L, "SQL exception", TS);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void pausedAndResumedUpdateStatus() {
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INCREMENTAL, SnapshotNotifications.PAUSED, Map.of()));
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INCREMENTAL, SnapshotNotifications.RESUMED, Map.of()));

        verify(activeService).updateStatus(PIPELINE_ID, SnapshotState.PAUSED, TS);
        verify(activeService).updateStatus(PIPELINE_ID, SnapshotState.RUNNING, TS);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void completedMovesSnapshotToHistory() {
        when(pipelineService.findById(PIPELINE_ID)).thenReturn(Optional.empty());

        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.COMPLETED, Map.of()));

        verify(historyService).historicize(eq(PIPELINE_ID), any(), eq(SnapshotState.COMPLETED), eq(TS));
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void abortedMovesSnapshotToHistory() {
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INCREMENTAL, SnapshotNotifications.ABORTED, Map.of()));

        verify(historyService).historicize(eq(PIPELINE_ID), any(), eq(SnapshotState.ABORTED), eq(TS));
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void nonSnapshotNotificationIsIgnored() {
        aggregator.accept(PIPELINE_ID, notification("Some Other Aggregate", SnapshotNotifications.STARTED, Map.of()));

        verifyNoInteractions(activeService, historyService);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void unknownSnapshotNotificationTypeIsIgnored() {
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL, "SOMETHING_NEW", Map.of()));

        verify(activeService, never()).create(anyLong(), any(), any(), any(), any());
        verify(historyService, never()).historicize(anyLong(), any(), any(), any());
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void currentStateIsIdleWhenNoActiveSnapshot() {
        SnapshotProgressResponse state = aggregator.currentState(PIPELINE_ID);

        assertThat(state.status()).isEqualTo(SnapshotState.IDLE);
        assertThat(state.type()).isNull();
        assertThat(state.globalProgress()).isNull();
        assertThat(state.tables()).isEmpty();
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void currentStateMergesChunkOverlayOntoCurrentTable() {
        // Populate the overlay with a chunk progress event for the in-progress table.
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.IN_PROGRESS,
                Map.of(SnapshotNotifications.K_CURRENT_COLLECTION, "inventory.orders",
                        SnapshotNotifications.K_CHUNK_INDEX, "3",
                        SnapshotNotifications.K_TOTAL_CHUNKS, "6",
                        SnapshotNotifications.K_ROWS_SCANNED, "3000")));

        ActiveSnapshotTable table = mockTable("inventory.orders", TableState.IN_PROGRESS, 0, 100L);
        ActiveSnapshot active = mockActive(SnapshotState.RUNNING);
        when(active.getTotalTables()).thenReturn(1);
        when(active.getStartedAt()).thenReturn(TS);
        when(active.getLastUpdatedAt()).thenReturn(TS);
        when(active.getTables()).thenReturn(List.of(table));
        when(activeService.find(PIPELINE_ID)).thenReturn(Optional.of(active));

        SnapshotProgressResponse state = aggregator.currentState(PIPELINE_ID);

        assertThat(state.status()).isEqualTo(SnapshotState.RUNNING);
        assertThat(state.tables()).hasSize(1);
        var tableProgress = state.tables().get(0);
        assertThat(tableProgress.name()).isEqualTo("inventory.orders");
        assertThat(tableProgress.progress().chunkNumber()).isEqualTo(4);
        assertThat(tableProgress.progress().totalChunks()).isEqualTo(6);
        assertThat(tableProgress.progress().percentage()).isEqualTo(50.0);
        // Live overlay row count wins over the (stale) persisted value.
        assertThat(tableProgress.rowsScanned()).isEqualTo(3000L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void chunkProgressForNewTableDoesNotInheritPreviousTableRows() {
        // A chunk event for the first table reports a row count...
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.IN_PROGRESS,
                Map.of(SnapshotNotifications.K_CURRENT_COLLECTION, "inventory.orders",
                        SnapshotNotifications.K_ROWS_SCANNED, "5000")));
        // ...then the scan moves to a second table with no row count yet; it must not inherit 5000.
        aggregator.accept(PIPELINE_ID, notification(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.IN_PROGRESS,
                Map.of(SnapshotNotifications.K_CURRENT_COLLECTION, "inventory.products")));

        ActiveSnapshotTable table = mockTable("inventory.products", TableState.IN_PROGRESS, 0, 0L);
        ActiveSnapshot active = mockActive(SnapshotState.RUNNING);
        when(active.getTotalTables()).thenReturn(1);
        when(active.getStartedAt()).thenReturn(TS);
        when(active.getLastUpdatedAt()).thenReturn(TS);
        when(active.getTables()).thenReturn(List.of(table));
        when(activeService.find(PIPELINE_ID)).thenReturn(Optional.of(active));

        SnapshotProgressResponse state = aggregator.currentState(PIPELINE_ID);

        assertThat(state.tables().get(0).name()).isEqualTo("inventory.products");
        assertThat(state.tables().get(0).rowsScanned()).isEqualTo(0L);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void staleTimestampChunkEventIsIgnored() {
        // First, a newer chunk event.
        aggregator.accept(PIPELINE_ID, notificationAt(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.IN_PROGRESS,
                Map.of(SnapshotNotifications.K_CURRENT_COLLECTION, "inventory.orders",
                        SnapshotNotifications.K_ROWS_SCANNED, "5000"),
                TS.toEpochMilli()));
        // Then an older (reordered) one; it must not overwrite the overlay.
        aggregator.accept(PIPELINE_ID, notificationAt(SnapshotNotifications.AGG_INITIAL, SnapshotNotifications.IN_PROGRESS,
                Map.of(SnapshotNotifications.K_CURRENT_COLLECTION, "inventory.orders",
                        SnapshotNotifications.K_ROWS_SCANNED, "1000"),
                TS.minusSeconds(30).toEpochMilli()));

        verify(activeService, times(1)).markInProgress(PIPELINE_ID, "inventory.orders", TS);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void firstStaleDetectionFlagsUnknownButKeepsRow() {
        Instant cutoff = TS.plusSeconds(900);
        Instant now = cutoff;
        ActiveSnapshot stale = mockActive(SnapshotState.RUNNING);
        when(stale.getLastUpdatedAt()).thenReturn(TS);
        when(activeService.findStale(cutoff)).thenReturn(List.of(stale));
        when(activeService.find(PIPELINE_ID)).thenReturn(Optional.of(stale));

        int closed = aggregator.closeStaleSnapshots(cutoff, now);

        assertThat(closed).isZero();
        verify(activeService).markStale(PIPELINE_ID);
        verify(historyService, never()).historicize(anyLong(), any(), any(), any());
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void secondStaleDetectionFinalizesUnknownToHistory() {
        Instant cutoff = TS.plusSeconds(900);
        Instant now = cutoff;
        ActiveSnapshot stale = mockActive(SnapshotState.UNKNOWN);
        when(stale.getLastUpdatedAt()).thenReturn(TS);
        when(activeService.findStale(cutoff)).thenReturn(List.of(stale));
        when(activeService.find(PIPELINE_ID)).thenReturn(Optional.of(stale));

        int closed = aggregator.closeStaleSnapshots(cutoff, now);

        assertThat(closed).isEqualTo(1);
        verify(historyService).historicize(eq(PIPELINE_ID), any(), eq(SnapshotState.UNKNOWN), eq(now));
        verify(activeService, never()).markStale(anyLong());
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void pausedSnapshotIsNotTreatedAsStale() {
        Instant cutoff = TS.plusSeconds(900);
        ActiveSnapshot paused = mockActive(SnapshotState.PAUSED);
        when(paused.getLastUpdatedAt()).thenReturn(TS);
        when(activeService.findStale(cutoff)).thenReturn(List.of(paused));
        when(activeService.find(PIPELINE_ID)).thenReturn(Optional.of(paused));

        int closed = aggregator.closeStaleSnapshots(cutoff, cutoff);

        assertThat(closed).isZero();
        verify(activeService, never()).markStale(anyLong());
        verify(historyService, never()).historicize(anyLong(), any(), any(), any());
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void snapshotRevivedBeforeSecondPassIsNotClosed() {
        Instant cutoff = TS.plusSeconds(900);
        ActiveSnapshot stale = mockActive(SnapshotState.RUNNING);
        when(activeService.findStale(cutoff)).thenReturn(List.of(stale));
        // A late update refreshed lastUpdatedAt past the cutoff between the query and the lock.
        ActiveSnapshot revived = mockActive(SnapshotState.RUNNING);
        when(revived.getLastUpdatedAt()).thenReturn(cutoff.plusSeconds(1));
        when(activeService.find(PIPELINE_ID)).thenReturn(Optional.of(revived));

        int closed = aggregator.closeStaleSnapshots(cutoff, cutoff);

        assertThat(closed).isZero();
        verify(activeService, never()).markStale(anyLong());
        verify(historyService, never()).historicize(anyLong(), any(), any(), any());
    }

    private void chunkProgressAt(String tableName, Instant timestamp) {
        aggregator.accept(PIPELINE_ID, notificationAt(SnapshotNotifications.AGG_INITIAL,
                SnapshotNotifications.TABLE_CHUNK_IN_PROGRESS,
                Map.of(SnapshotNotifications.K_CURRENT_COLLECTION, tableName,
                        SnapshotNotifications.K_ROWS_SCANNED, "1000"),
                timestamp.toEpochMilli()));
    }

    private static SnapshotNotificationRequest notification(String aggregateType, String type, Map<String, String> data) {
        return notificationAt(aggregateType, type, data, TS.toEpochMilli());
    }

    private static SnapshotNotificationRequest notificationAt(String aggregateType, String type,
                                                              Map<String, String> data, long timestamp) {
        return new SnapshotNotificationRequest("id-1", aggregateType, type, data, timestamp);
    }

    private static ActiveSnapshot mockActive(SnapshotState status) {
        ActiveSnapshot active = org.mockito.Mockito.mock(ActiveSnapshot.class);
        when(active.getPipelineId()).thenReturn(PIPELINE_ID);
        when(active.getType()).thenReturn(SnapshotType.INITIAL);
        when(active.getStatus()).thenReturn(status);
        return active;
    }

    private static ActiveSnapshotTable mockTable(String name, TableState state, int orderIndex, long rowsScanned) {
        ActiveSnapshotTable table = org.mockito.Mockito.mock(ActiveSnapshotTable.class);
        when(table.getTableName()).thenReturn(name);
        when(table.getState()).thenReturn(state);
        when(table.getOrderIndex()).thenReturn(orderIndex);
        when(table.getRowsScanned()).thenReturn(rowsScanned);
        return table;
    }
}
