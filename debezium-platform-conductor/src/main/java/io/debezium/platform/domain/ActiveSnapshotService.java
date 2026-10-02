/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static jakarta.transaction.Transactional.TxType.SUPPORTS;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;
import com.blazebit.persistence.view.EntityViewSetting;

import io.debezium.connector.SnapshotType;
import io.debezium.platform.data.model.ActiveSnapshotEntity;
import io.debezium.platform.data.model.ActiveSnapshotTableEntity;
import io.debezium.platform.data.model.SnapshotState;
import io.debezium.platform.data.model.TableState;
import io.debezium.platform.domain.views.ActiveSnapshot;
import io.debezium.platform.domain.views.refs.ActiveSnapshotReference;

/**
 * Persistence for the active tier of snapshot monitoring (DDD-68). Holds the structural state of the
 * snapshot currently running for a pipeline; high-frequency chunk progress lives in memory (see
 * {@code SnapshotProgressAggregator}) and is never written here.
 *
 */
@ApplicationScoped
public class ActiveSnapshotService extends AbstractService<ActiveSnapshotEntity, ActiveSnapshot, ActiveSnapshotReference> {

    private static final String PIPELINE_ID_ATTRIBUTE = "pipelineId";
    private static final String LAST_UPDATED_AT_ATTRIBUTE = "lastUpdatedAt";
    private static final String STATUS_ATTRIBUTE = "status";
    private static final String PIPELINE_ID_PARAMETER = "pipelineId";

    public ActiveSnapshotService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm) {
        super(ActiveSnapshotEntity.class, ActiveSnapshot.class, ActiveSnapshotReference.class, em, cbf, evm);
    }

    /**
     * The active snapshot view for a pipeline, if one is running.
     */
    @Transactional(SUPPORTS)
    public Optional<ActiveSnapshot> find(Long pipelineId) {
        return evm.applySetting(
                EntityViewSetting.create(ActiveSnapshot.class),
                cb().where(PIPELINE_ID_ATTRIBUTE).eq(pipelineId))
                .getResultList().stream().findFirst();
    }

    /**
     * Active snapshots whose last update predates {@code cutoff}. Used by the staleness watchdog.
     * {@code PAUSED} snapshots are excluded: a pause is a legitimate quiescent state, not a stall, so
     * it must not be treated as stale.
     */
    @Transactional(SUPPORTS)
    public List<ActiveSnapshot> findStale(Instant cutoff) {
        return evm.applySetting(
                EntityViewSetting.create(ActiveSnapshot.class),
                cb().where(LAST_UPDATED_AT_ATTRIBUTE).lt(cutoff)
                        .where(STATUS_ATTRIBUTE).notEq(SnapshotState.PAUSED))
                .getResultList();
    }

    /**
     * The managed entity for a pipeline's active snapshot, for mutating writes and for the atomic
     * move to history. Returns {@code null} when none is running.
     */
    @Transactional(SUPPORTS)
    public ActiveSnapshotEntity findEntity(Long pipelineId) {
        return em.createNamedQuery(ActiveSnapshotEntity.FIND_BY_PIPELINE_ID, ActiveSnapshotEntity.class)
                .setParameter(PIPELINE_ID_PARAMETER, pipelineId)
                .getResultStream()
                .findFirst()
                .orElse(null);
    }

    /**
     * Creates the active snapshot for a pipeline. {@code tableNames} must be non-null but may be empty
     * when the connector does not report the table list up front; rows are then back-filled lazily.
     */
    @Transactional
    public ActiveSnapshotEntity create(Long pipelineId, SnapshotType type, String correlationId,
                                       List<String> tableNames, Instant startedAt) {
        ActiveSnapshotEntity active = new ActiveSnapshotEntity();
        active.setPipelineId(pipelineId);
        active.setType(type);
        active.setStatus(SnapshotState.RUNNING);
        active.setCorrelationId(correlationId);
        active.setTotalTables(tableNames.size());
        active.setStartedAt(startedAt);
        active.setLastUpdatedAt(startedAt);

        IntStream.range(0, tableNames.size())
                .mapToObj(orderIndex -> pendingTable(tableNames.get(orderIndex), orderIndex))
                .forEach(active::addTable);

        em.persist(active);
        return active;
    }

    private static ActiveSnapshotTableEntity pendingTable(String tableName, int orderIndex) {
        ActiveSnapshotTableEntity table = new ActiveSnapshotTableEntity();
        table.setTableName(tableName);
        table.setState(TableState.PENDING);
        table.setOrderIndex(orderIndex);
        table.setRowsScanned(0L);
        return table;
    }

    /**
     * Ensures every table in {@code tableNames} exists on the active snapshot, back-filling any that are
     * missing as {@code PENDING} and keeping {@code totalTables} in sync. This is how the full table set
     * becomes known when the connector reports it on progress notifications ({@code data_collections})
     * rather than at {@code STARTED}: registering the whole set at once keeps {@code totalTables} correct
     * from the first progress event instead of growing it one table at a time. Existing rows (and their
     * state) are left untouched. No-op when the pipeline has no active snapshot or the list is empty.
     */
    @Transactional
    public void registerTables(Long pipelineId, List<String> tableNames, Instant when) {
        if (tableNames == null || tableNames.isEmpty()) {
            return;
        }
        ActiveSnapshotEntity active = findEntity(pipelineId);
        if (active == null) {
            return;
        }
        boolean added = false;
        for (String tableName : tableNames) {
            if (findTable(active, tableName) == null) {
                active.addTable(pendingTable(tableName, active.getTables().size()));
                added = true;
            }
        }
        if (added) {
            active.setTotalTables(active.getTables().size());
            touch(active, when);
        }
    }

    /**
     * Back-fills a table row for a snapshot whose table list was not known up front, or updates the
     * existing row, marking it {@code IN_PROGRESS} and keeping {@code totalTables} in sync. No-op when
     * the pipeline has no active snapshot (a chunk event arriving before {@code STARTED}).
     */
    @Transactional
    public void markInProgress(Long pipelineId, String tableName, Instant when) {
        if (tableName == null) {
            return;
        }
        ActiveSnapshotEntity active = findEntity(pipelineId);
        if (active == null) {
            return;
        }
        revive(active);
        ActiveSnapshotTableEntity table = findTable(active, tableName);
        if (table == null) {
            table = new ActiveSnapshotTableEntity();
            table.setTableName(tableName);
            table.setOrderIndex(active.getTables().size());
            table.setRowsScanned(0L);
            active.addTable(table);
            active.setTotalTables(active.getTables().size());
        }
        if (table.getStartedAt() == null) {
            table.setStartedAt(when);
        }
        if (table.getState() == null || table.getState() == TableState.PENDING) {
            table.setState(TableState.IN_PROGRESS);
        }
        touch(active, when);
    }

    /**
     * Records a terminal per-table outcome ({@code COMPLETED}/{@code SKIPPED}/{@code FAILED}).
     * Idempotent: does not regress a table that is already in a terminal state. No-op when the
     * pipeline has no active snapshot.
     */
    @Transactional
    public void completeTable(Long pipelineId, String tableName, TableState outcome,
                              long rowsScanned, String skipReason, Instant when) {
        if (tableName == null) {
            return;
        }
        ActiveSnapshotEntity active = findEntity(pipelineId);
        if (active == null) {
            return;
        }
        revive(active);
        ActiveSnapshotTableEntity table = findTable(active, tableName);
        if (table == null) {
            table = new ActiveSnapshotTableEntity();
            table.setTableName(tableName);
            table.setOrderIndex(active.getTables().size());
            table.setStartedAt(when);
            active.addTable(table);
            active.setTotalTables(active.getTables().size());
        }
        table.setState(outcome);
        table.setRowsScanned(rowsScanned);
        table.setSkipReason(skipReason);
        table.setCompletedAt(when);
        touch(active, when);
    }

    /**
     * Updates the snapshot status (e.g. RUNNING &harr; PAUSED). No-op when the pipeline has no active
     * snapshot.
     */
    @Transactional
    public void updateStatus(Long pipelineId, SnapshotState status, Instant when) {
        ActiveSnapshotEntity active = findEntity(pipelineId);
        if (active == null) {
            return;
        }
        active.setStatus(status);
        touch(active, when);
    }

    /**
     * Flags the active snapshot as {@link SnapshotState#UNKNOWN} <em>without</em> touching
     * {@code lastUpdatedAt}, so the next watchdog pass still sees it as stale. This is the first strike
     * of the staleness watchdog: keeping the row (instead of moving it straight to history) lets a late
     * chunk/table notification revive a snapshot that was merely slow (see {@link #markInProgress} /
     * {@link #completeTable}, which reset the status to {@code RUNNING}). No-op when the pipeline has no
     * active snapshot.
     */
    @Transactional
    public void markStale(Long pipelineId) {
        ActiveSnapshotEntity active = findEntity(pipelineId);
        if (active == null) {
            return;
        }
        active.setStatus(SnapshotState.UNKNOWN);
    }

    /**
     * Removes the active snapshot (after it has been moved to history).
     */
    @Transactional
    public void remove(ActiveSnapshotEntity active) {
        ActiveSnapshotEntity managed = em.contains(active) ? active : em.merge(active);
        em.remove(managed);
    }

    private static ActiveSnapshotTableEntity findTable(ActiveSnapshotEntity active, String tableName) {
        return active.getTables().stream()
                .filter(t -> t.getTableName().equals(tableName))
                .findFirst()
                .orElse(null);
    }

    private static void touch(ActiveSnapshotEntity active, Instant when) {
        active.setLastUpdatedAt(when);
    }

    /**
     * Restores a snapshot the watchdog had flagged as {@code UNKNOWN} back to {@code RUNNING} when a
     * fresh progress notification proves it is still alive (it was merely slow).
     */
    private static void revive(ActiveSnapshotEntity active) {
        if (active.getStatus() == SnapshotState.UNKNOWN) {
            active.setStatus(SnapshotState.RUNNING);
        }
    }
}
