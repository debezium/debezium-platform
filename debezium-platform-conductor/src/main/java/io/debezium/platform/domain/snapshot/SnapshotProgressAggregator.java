/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.snapshot;

import static io.debezium.platform.domain.snapshot.SnapshotNotifications.K_DATA_COLLECTIONS;
import static io.debezium.platform.domain.snapshot.SnapshotNotifications.K_ROWS_SCANNED;
import static io.debezium.platform.domain.snapshot.SnapshotNotifications.K_SCANNED_COLLECTION;
import static io.debezium.platform.domain.snapshot.SnapshotNotifications.K_STATUS;
import static java.util.Comparator.comparingInt;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import jakarta.enterprise.context.ApplicationScoped;

import io.debezium.connector.SnapshotType;
import io.debezium.platform.api.dto.SnapshotNotificationRequest;
import io.debezium.platform.api.dto.SnapshotProgressResponse;
import io.debezium.platform.api.dto.SnapshotProgressResponse.GlobalProgress;
import io.debezium.platform.api.dto.SnapshotProgressResponse.TableProgress;
import io.debezium.platform.config.SnapshotMonitoringConfigGroup;
import io.debezium.platform.data.model.SnapshotState;
import io.debezium.platform.data.model.TableState;
import io.debezium.platform.domain.ActiveSnapshotService;
import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.domain.SnapshotHistoryService;
import io.debezium.platform.domain.snapshot.ChunkProgressTracker.RecordOutcome;
import io.debezium.platform.domain.snapshot.SnapshotNotifications.TableOutcome;
import io.debezium.platform.domain.views.ActiveSnapshot;
import io.debezium.platform.domain.views.ActiveSnapshotTable;
import io.debezium.platform.domain.views.Pipeline;
import io.debezium.util.Strings;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor;

/**
 * The heart of snapshot monitoring (DDD-68): consumes Debezium snapshot {@code Notification} events
 * per pipeline, drives the two-tier persistence (active rows via {@link ActiveSnapshotService},
 * history via {@link SnapshotHistoryService}), keeps a high-frequency in-memory chunk overlay, and
 * pushes the full current state to SSE subscribers.
 * <p>
 * Every SSE event is the complete {@link SnapshotProgressResponse} (never a delta). Handling for one
 * pipeline is serialized by a per-pipeline lock; different pipelines proceed concurrently.
 */
@ApplicationScoped
public class SnapshotProgressAggregator {

    private final ActiveSnapshotService activeService;
    private final SnapshotHistoryService historyService;
    private final PipelineService pipelineService;
    private final Duration broadcastDebounce;
    private final Duration progressHeartbeat;

    // One broadcast pipe per pipeline that has (or had) subscribers.
    private final Map<Long, BroadcastProcessor<SnapshotProgressResponse>> broadcasters = new ConcurrentHashMap<>();
    // High-frequency chunk state, never persisted; only ever touched under the per-pipeline lock.
    private final ChunkProgressTracker chunkProgress = new ChunkProgressTracker();
    // Per-pipeline lock to serialize notification handling for one pipeline.
    private final Map<Long, Object> locks = new ConcurrentHashMap<>();
    // Debounce bookkeeping: last broadcast timestamp per pipeline.
    private final Map<Long, Instant> lastBroadcast = new ConcurrentHashMap<>();
    // Heartbeat bookkeeping: timestamp of the last chunk progress actually persisted, per pipeline.
    private final Map<Long, Instant> lastProgressPersist = new ConcurrentHashMap<>();

    public SnapshotProgressAggregator(ActiveSnapshotService activeService,
                                      SnapshotHistoryService historyService, PipelineService pipelineService,
                                      SnapshotMonitoringConfigGroup config) {
        this.activeService = activeService;
        this.historyService = historyService;
        this.pipelineService = pipelineService;
        this.broadcastDebounce = config.sse().debounce();
        this.progressHeartbeat = config.watchdog().heartbeat();
    }

    /**
     * Ingests one notification for a pipeline. Non-snapshot notifications are ignored.
     */
    public void accept(Long pipelineId, SnapshotNotificationRequest notification) {
        if (!SnapshotNotifications.isSnapshotAggregate(notification.aggregateType())) {
            return;
        }
        synchronized (lockFor(pipelineId)) {
            boolean isCheckpointEvent = true;
            switch (notification.type()) {
                case SnapshotNotifications.STARTED -> onStarted(pipelineId, notification);
                case SnapshotNotifications.DATA_COLLECTIONS_RESOLVED -> onDataCollectionsResolved(pipelineId, notification);
                case SnapshotNotifications.IN_PROGRESS, SnapshotNotifications.TABLE_CHUNK_IN_PROGRESS,
                        SnapshotNotifications.TABLE_CHUNK_COMPLETED -> {
                    onChunkProgress(pipelineId, notification);
                    isCheckpointEvent = false;
                }
                case SnapshotNotifications.TABLE_SCAN_COMPLETED -> onTableCompleted(pipelineId, notification);
                case SnapshotNotifications.PAUSED -> onStatus(pipelineId, notification, SnapshotState.PAUSED);
                case SnapshotNotifications.RESUMED -> onStatus(pipelineId, notification, SnapshotState.RUNNING);
                case SnapshotNotifications.COMPLETED -> onTerminal(pipelineId, notification, SnapshotState.COMPLETED);
                case SnapshotNotifications.ABORTED -> onTerminal(pipelineId, notification, SnapshotState.ABORTED);
                case SnapshotNotifications.SKIPPED -> onTerminal(pipelineId, notification, SnapshotState.SKIPPED);
                default -> {
                    return; // unknown type: acknowledged and ignored, no broadcast
                }
            }
            broadcastDebounced(pipelineId, isCheckpointEvent);
        }
    }

    /**
     * The current full state for a pipeline: the persisted structural rows merged with the in-memory
     * chunk overlay. Returns the IDLE payload when no snapshot is active.
     */
    public SnapshotProgressResponse currentState(Long pipelineId) {
        // Read under the per-pipeline lock so the chunk overlay (mutated by accept() only under the
        // same lock) is observed consistently. The lock is reentrant, so broadcastDebounced(), which
        // already holds it, can call through. SSE read paths acquire it here.
        synchronized (lockFor(pipelineId)) {
            Optional<ActiveSnapshot> active = activeService.find(pipelineId);
            if (active.isEmpty()) {
                return SnapshotProgressResponse.idle();
            }
            ActiveSnapshot activeSnapshot = active.get();

            List<TableProgress> tables = activeSnapshot.getTables().stream()
                    .sorted(comparingInt(ActiveSnapshotTable::getOrderIndex))
                    .map(table -> chunkProgress.toTableProgress(pipelineId, table))
                    .toList();

            int completed = 0;
            long totalRows = 0L;
            for (TableProgress table : tables) {
                if (table.status() == TableState.COMPLETED) {
                    completed++;
                }
                totalRows += table.rowsScanned();
            }
            double percentage = activeSnapshot.getTotalTables() > 0
                    ? completed * 100.0 / activeSnapshot.getTotalTables()
                    : 0.0;

            Instant lastUpdated = chunkProgress.latestUpdate(pipelineId, activeSnapshot.getLastUpdatedAt());
            long elapsedSeconds = Math.max(0L, Duration.between(activeSnapshot.getStartedAt(), Instant.now()).toSeconds());

            return new SnapshotProgressResponse(
                    activeSnapshot.getType(),
                    activeSnapshot.getStatus(),
                    new GlobalProgress(activeSnapshot.getTotalTables(), completed, percentage),
                    tables,
                    activeSnapshot.getStartedAt(),
                    lastUpdated,
                    elapsedSeconds,
                    totalRows);
        }
    }

    /**
     * Live stream of full-state updates for a pipeline. The SSE resource prepends the current state
     * as the first event.
     */
    public Multi<SnapshotProgressResponse> subscribe(Long pipelineId) {
        return broadcasters.computeIfAbsent(pipelineId, key -> BroadcastProcessor.create());
    }

    /**
     * The staleness watchdog. Snapshots that stopped receiving updates before {@code cutoff} are handled
     * in two strikes so a merely-slow snapshot is not lost: the first stale pass flags the snapshot as
     * {@code UNKNOWN} but keeps its active row (a late chunk/table event revives it back to
     * {@code RUNNING}); only if it is still stale on a later pass is it finalized into history as
     * {@code UNKNOWN}. {@code PAUSED} snapshots are never treated as stale. Runs each transition under the
     * pipeline lock and re-checks state to avoid racing a late update or a terminal notification. Returns
     * the number of snapshots finalized (second strike).
     */
    public int closeStaleSnapshots(Instant cutoff, Instant now) {
        int closed = 0;
        for (ActiveSnapshot stale : activeService.findStale(cutoff)) {
            Long pipelineId = stale.getPipelineId();
            synchronized (lockFor(pipelineId)) {
                Optional<ActiveSnapshot> current = activeService.find(pipelineId);
                if (current.isEmpty()) {
                    continue; // a terminal notification removed it between the query and the lock
                }
                ActiveSnapshot snapshot = current.get();
                if (snapshot.getStatus() == SnapshotState.PAUSED || !snapshot.getLastUpdatedAt().isBefore(cutoff)) {
                    continue; // paused, or revived by a late update between the query and the lock
                }
                if (snapshot.getStatus() == SnapshotState.UNKNOWN) {
                    // Second strike: already flagged UNKNOWN on a previous pass and still no updates, so the
                    // snapshot really is gone -> finalize it into history.
                    historyService.historicize(pipelineId, resolveName(pipelineId), SnapshotState.UNKNOWN, now);
                    discardRuntimeState(pipelineId);
                    closed++;
                }
                else {
                    // First strike: flag as UNKNOWN but keep the active row so a late chunk/table event can
                    // revive a snapshot that was merely slow (see ActiveSnapshotService#markStale).
                    activeService.markStale(pipelineId);
                }
                broadcastDebounced(pipelineId, true);
            }
        }
        return closed;
    }

    private void onStarted(Long pipelineId, SnapshotNotificationRequest notification) {
        // A STARTED while a snapshot is already active means the previous run was interrupted
        // (e.g. a Debezium Server restart mid-snapshot); close it as ABORTED before starting fresh.
        if (activeService.find(pipelineId).isPresent()) {
            historyService.closeAsAborted(pipelineId, resolveName(pipelineId), instantOf(notification));
        }
        SnapshotType type = SnapshotNotifications.typeOf(notification.aggregateType());
        List<String> tables = parseTables(notification.additionalData().get(K_DATA_COLLECTIONS));
        activeService.create(pipelineId, type, correlationId(notification), tables, instantOf(notification));
        discardRuntimeState(pipelineId);
    }

    private void onDataCollectionsResolved(Long pipelineId, SnapshotNotificationRequest notification) {
        // Connectors resolve the captured table set just after STARTED and report it in a dedicated
        // DATA_COLLECTIONS_RESOLVED notification (STARTED itself does not carry it). Registering the whole
        // set here keeps totalTables correct from the outset instead of growing one table at a time as
        // each table is scanned.
        activeService.registerTables(pipelineId, parseTables(notification.additionalData().get(K_DATA_COLLECTIONS)),
                instantOf(notification));
    }

    private void onChunkProgress(Long pipelineId, SnapshotNotificationRequest notification) {
        Instant timestamp = instantOf(notification);
        ChunkProgressEvent event = ChunkProgressEvent.from(notification.type(), notification.additionalData());
        if (event.currentTable() == null) {
            return; // no table to attribute the chunk to: neither the overlay nor the active row can use it
        }
        RecordOutcome outcome = chunkProgress.record(pipelineId, event, timestamp);
        if (outcome == RecordOutcome.STALE) {
            return; // reordered chunk event, already superseded
        }
        // Chunk events are the high-frequency ones, and every snapshot thread of a pipeline writes the
        // same active_snapshot row. Only a table's first event is persisted eagerly: that one is
        // structural, since markInProgress creates the table row (back-filling the list when the table
        // set was not known at STARTED) and moves it to IN_PROGRESS. The rest merely refresh
        // last_updated_at so the staleness watchdog does not fire mid-scan, which a periodic heartbeat
        // does just as well. The live view is unaffected: currentState() takes the latest of the
        // persisted timestamp and the in-memory overlays, which every event updates.
        if (outcome != RecordOutcome.FIRST_FOR_TABLE
                && !intervalElapsed(lastProgressPersist, pipelineId, timestamp, progressHeartbeat)) {
            return;
        }
        activeService.markInProgress(pipelineId, event.currentTable(), timestamp);
        lastProgressPersist.put(pipelineId, timestamp);
    }

    private void onTableCompleted(Long pipelineId, SnapshotNotificationRequest notification) {
        String table = notification.additionalData().get(K_SCANNED_COLLECTION);
        long rows = Strings.asLong(notification.additionalData().get(K_ROWS_SCANNED), 0L);
        TableOutcome outcome = SnapshotNotifications.toTableOutcome(notification.additionalData().get(K_STATUS));
        activeService.completeTable(pipelineId, table, outcome.state(), rows, outcome.reason(), instantOf(notification));
        chunkProgress.completeTable(pipelineId, table);
    }

    private void onStatus(Long pipelineId, SnapshotNotificationRequest notification, SnapshotState status) {
        activeService.updateStatus(pipelineId, status, instantOf(notification));
    }

    private void onTerminal(Long pipelineId, SnapshotNotificationRequest notification, SnapshotState outcome) {
        historyService.historicize(pipelineId, resolveName(pipelineId), outcome, instantOf(notification));
        discardRuntimeState(pipelineId);
        // A final IDLE state is broadcast by broadcastDebounced -> currentState() (no active row => IDLE).
    }

    private void broadcastDebounced(Long pipelineId, boolean isCheckpointEvent) {
        BroadcastProcessor<SnapshotProgressResponse> broadcaster = broadcasters.get(pipelineId);
        if (broadcaster == null) {
            return; // nobody subscribed; avoid the state read entirely
        }
        Instant now = Instant.now();
        if (!isCheckpointEvent && !intervalElapsed(lastBroadcast, pipelineId, now, broadcastDebounce)) {
            return; // within the debounce window for a high-frequency chunk update
        }
        lastBroadcast.put(pipelineId, now);
        broadcaster.onNext(currentState(pipelineId));
    }

    /**
     * Whether {@code interval} has elapsed since the pipeline's last entry in {@code lastRun}, which is
     * also the case when there is no entry yet. Shared by the two per-pipeline throttles: the SSE
     * broadcast debounce and the chunk-progress persistence heartbeat.
     * <p>
     * A {@code now} that moved backwards also counts as elapsed. The heartbeat compares notification
     * timestamps, which are produced by the connector and can step back (a clock correction, or events
     * for two tables crossing), and a single timestamp from the future would otherwise wedge the
     * throttle until real time caught up with it.
     */
    private static boolean intervalElapsed(Map<Long, Instant> lastRun, Long pipelineId, Instant now, Duration interval) {
        Instant previous = lastRun.get(pipelineId);
        return previous == null || now.isBefore(previous) || Duration.between(previous, now).compareTo(interval) >= 0;
    }

    private Object lockFor(Long pipelineId) {
        return locks.computeIfAbsent(pipelineId, key -> new Object());
    }

    /**
     * Drops the in-memory per-pipeline state that only makes sense within a single run (the chunk overlay,
     * the debounce timestamp and the heartbeat timestamp), once the snapshot has ended or when a new one
     * starts. The lock and broadcast pipe are intentionally retained: the lock guards concurrent handling
     * and cannot be removed safely from inside its own critical section, and the broadcaster keeps serving
     * any live SSE subscribers.
     */
    private void discardRuntimeState(Long pipelineId) {
        chunkProgress.clear(pipelineId);
        lastBroadcast.remove(pipelineId);
        lastProgressPersist.remove(pipelineId);
    }

    private String resolveName(Long pipelineId) {
        return pipelineService.findById(pipelineId).map(Pipeline::getName).orElse(null);
    }

    private static Instant instantOf(SnapshotNotificationRequest notification) {
        return notification.timestamp() != null ? Instant.ofEpochMilli(notification.timestamp()) : Instant.now();
    }

    private static String correlationId(SnapshotNotificationRequest notification) {
        String correlationId = notification.additionalData().get("correlation_id");
        return Strings.isNullOrBlank(correlationId) ? null : correlationId;
    }

    /**
     * Parses the {@code data_collections} additional-data value into a table list. Accepts both a
     * bracketed list ({@code "[a, b]"}) and a plain comma-separated string; returns an empty list
     * when absent (the list is then back-filled lazily).
     */
    private static List<String> parseTables(String raw) {
        if (Strings.isNullOrBlank(raw)) {
            return List.of();
        }
        String trimmed = raw.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            trimmed = trimmed.substring(1, trimmed.length() - 1);
        }
        List<String> tables = new ArrayList<>();
        for (String part : trimmed.split(",")) {
            String name = part.trim();
            if (!name.isEmpty()) {
                tables.add(name);
            }
        }
        return tables;
    }
}
