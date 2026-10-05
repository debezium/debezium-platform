/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.snapshot;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import io.debezium.platform.api.dto.SnapshotProgressResponse.TableProgress;
import io.debezium.platform.api.dto.SnapshotProgressResponse.TableProgress.ChunkProgress;
import io.debezium.platform.data.model.TableState;
import io.debezium.platform.domain.views.ActiveSnapshotTable;

/**
 * Owns the high-frequency, in-memory chunk overlays per pipeline (DDD-68) and the logic
 * that merges them onto the persisted table rows. Chunk events arrive far too often to persist, so
 * only the latest chunk state per in-progress table is kept and spliced onto that table when a
 * progress view is assembled. A separate overlay per table (keyed by table name) keeps live progress
 * correct when several tables are scanned at once (parallel snapshot, {@code snapshot.max.threads > 1}).
 * Overlays are never persisted and are rebuilt from the next {@code IN_PROGRESS} notifications after a
 * Conductor restart (degradation applies in the gap).
 * <p>
 * Not internally synchronized: every method must be called under {@link SnapshotProgressAggregator}'s
 * per-pipeline lock, which serializes all reads and writes for a given pipeline. The inner per-table
 * map is therefore a plain {@link HashMap}.
 */
public class ChunkProgressTracker {

    private final Map<Long, Map<String, ChunkOverlay>> overlays = new ConcurrentHashMap<>();

    /**
     * What {@link #record(Long, ChunkProgressEvent, Instant)} did with an event. Callers distinguish a
     * table's first event (the one whose table row still has to be created and moved to
     * {@code IN_PROGRESS}) from the subsequent ones, which only carry progress.
     */
    enum RecordOutcome {
        FIRST_FOR_TABLE,
        UPDATED,
        STALE
    }

    /**
     * Records a chunk-progress update for the event's table. Events older than the latest one already
     * seen for that table (per-table reordering guard) are ignored and reported as
     * {@link RecordOutcome#STALE}.
     */
    RecordOutcome record(Long pipelineId, ChunkProgressEvent event, Instant timestamp) {
        Map<String, ChunkOverlay> tableOverlays = overlays.computeIfAbsent(pipelineId, key -> new HashMap<>());
        ChunkOverlay previous = tableOverlays.get(event.currentTable());
        if (previous != null && timestamp.isBefore(previous.lastUpdatedAt())) {
            return RecordOutcome.STALE;
        }
        // Keep the last known row count when this event omits it; only overwrite on a reported value.
        long rowsScanned = event.rowsScanned() != null
                ? event.rowsScanned()
                : (previous != null ? previous.rowsScanned() : 0L);
        tableOverlays.put(event.currentTable(),
                new ChunkOverlay(event.chunkNumber(), event.completedChunks(), event.totalChunks(), rowsScanned,
                        timestamp));
        return previous == null ? RecordOutcome.FIRST_FOR_TABLE : RecordOutcome.UPDATED;
    }

    /**
     * Merges the overlay for a pipeline onto a persisted table row, producing the view-model entry.
     * When an overlay exists for the table, the live row count wins over the (possibly stale) persisted
     * value and the chunk progress is attached. A table that already reached a terminal state keeps its
     * persisted values: its counts are final, and a chunk event that arrives after the table was
     * completed (a retried notification, see {@code snapshot.monitoring.notification.retries}) must not
     * put a progress bar back on it.
     */
    TableProgress toTableProgress(Long pipelineId, ActiveSnapshotTable table) {
        ChunkOverlay overlay = isTerminal(table.getState()) ? null : overlayFor(pipelineId, table.getTableName());
        long rows = table.getRowsScanned();
        ChunkProgress chunk = null;
        if (overlay != null) {
            rows = Math.max(rows, overlay.rowsScanned());
            if (overlay.chunkNumber() != null && overlay.totalChunks() != null && overlay.totalChunks() > 0) {
                // The chunk being worked on is reported as-is, while the bar only counts finished chunks,
                // so it reaches 100% on the last chunk's completion and not when that chunk starts.
                double chunkPercentage = Math.min(100.0, overlay.completedChunks() * 100.0 / overlay.totalChunks());
                chunk = new ChunkProgress(overlay.chunkNumber(), overlay.totalChunks(), chunkPercentage);
            }
        }
        return new TableProgress(table.getTableName(), table.getState(), chunk, rows, table.getSkipReason());
    }

    /**
     * The most recent of the persisted last-updated timestamp and any live overlay timestamp, so the
     * view reflects chunk activity that has not been persisted yet.
     */
    Instant latestUpdate(Long pipelineId, Instant persisted) {
        Map<String, ChunkOverlay> tableOverlays = overlays.get(pipelineId);
        if (tableOverlays == null) {
            return persisted;
        }
        Instant latest = persisted;
        for (ChunkOverlay overlay : tableOverlays.values()) {
            if (overlay.lastUpdatedAt().isAfter(latest)) {
                latest = overlay.lastUpdatedAt();
            }
        }
        return latest;
    }

    /**
     * Drops the overlay for a table that just finished scanning (its final count is now persisted).
     */
    void completeTable(Long pipelineId, String tableName) {
        Map<String, ChunkOverlay> tableOverlays = overlays.get(pipelineId);
        if (tableOverlays != null) {
            tableOverlays.remove(tableName);
        }
    }

    /**
     * Discards all overlays for a pipeline (on a fresh start or when the snapshot ends).
     */
    void clear(Long pipelineId) {
        overlays.remove(pipelineId);
    }

    private static boolean isTerminal(TableState state) {
        return state == TableState.COMPLETED || state == TableState.SKIPPED || state == TableState.FAILED;
    }

    private ChunkOverlay overlayFor(Long pipelineId, String tableName) {
        Map<String, ChunkOverlay> tableOverlays = overlays.get(pipelineId);
        return tableOverlays == null ? null : tableOverlays.get(tableName);
    }
}
