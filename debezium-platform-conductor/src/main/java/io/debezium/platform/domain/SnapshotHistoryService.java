/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static jakarta.transaction.Transactional.TxType.SUPPORTS;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import com.blazebit.persistence.CriteriaBuilder;
import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.PagedList;
import com.blazebit.persistence.view.EntityViewManager;
import com.blazebit.persistence.view.EntityViewSetting;

import io.debezium.connector.SnapshotType;
import io.debezium.platform.api.dto.PagedSnapshotHistoryResponse;
import io.debezium.platform.api.dto.SnapshotHistoryResponse;
import io.debezium.platform.api.dto.SnapshotHistoryResponse.TableHistoryEntry;
import io.debezium.platform.data.model.ActiveSnapshotEntity;
import io.debezium.platform.data.model.ActiveSnapshotTableEntity;
import io.debezium.platform.data.model.SnapshotHistoryEntity;
import io.debezium.platform.data.model.SnapshotState;
import io.debezium.platform.data.model.SnapshotTableHistoryEntity;
import io.debezium.platform.data.model.TableState;
import io.debezium.platform.domain.views.SnapshotHistory;
import io.debezium.platform.domain.views.SnapshotHistorySummary;
import io.debezium.platform.domain.views.SnapshotTableHistory;
import io.debezium.platform.domain.views.refs.SnapshotHistoryReference;

/**
 * Persistence for the history tier of snapshot monitoring (DDD-68). A history row is created when an
 * active snapshot reaches a terminal state (via {@link #historicize}); rows are removed only by
 * retention cleanup.
 * <p>
 * Reads go through Blazebit entity views ({@link SnapshotHistorySummary} for the list,
 * {@link SnapshotHistory} for the detail); writes use managed entities directly, mirroring
 * {@code AlertEventService}.
 */
@ApplicationScoped
public class SnapshotHistoryService extends AbstractService<SnapshotHistoryEntity, SnapshotHistory, SnapshotHistoryReference> {

    private static final String PIPELINE_ID_ATTRIBUTE = "pipelineId";
    private static final String TYPE_ATTRIBUTE = "type";
    private static final String OUTCOME_ATTRIBUTE = "outcome";
    private static final String COMPLETED_AT_ATTRIBUTE = "completedAt";
    private static final String PRIMARY_KEY_ATTRIBUTE = "id";
    private static final String CUTOFF_PARAMETER = "cutoff";

    private final ActiveSnapshotService activeSnapshotService;

    public SnapshotHistoryService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm,
                                  ActiveSnapshotService activeSnapshotService) {
        super(SnapshotHistoryEntity.class, SnapshotHistory.class, SnapshotHistoryReference.class, em, cbf, evm);
        this.activeSnapshotService = activeSnapshotService;
    }

    /**
     * Atomically moves the active snapshot for a pipeline into history with the given outcome and
     * removes it from the active tier. No-op (returns {@code null}) when no active snapshot exists,
     * so terminal notifications and the watchdog can race without harm.
     */
    @Transactional
    public SnapshotHistoryEntity historicize(Long pipelineId, String pipelineName, SnapshotState outcome, Instant completedAt) {
        ActiveSnapshotEntity active = activeSnapshotService.findEntity(pipelineId);
        if (active == null) {
            return null;
        }

        SnapshotHistoryEntity history = new SnapshotHistoryEntity();
        history.setPipelineId(pipelineId);
        history.setPipelineName(pipelineName);
        history.setType(active.getType());
        history.setOutcome(outcome);
        history.setStartedAt(active.getStartedAt());
        history.setCompletedAt(completedAt);
        // Clamp to 0: startedAt (a notification timestamp) and completedAt (a notification timestamp
        // or the watchdog's Instant.now()) can come from different clocks, which could otherwise yield
        // a negative duration in the not-null column.
        history.setDurationSeconds(Math.max(0L, Duration.between(active.getStartedAt(), completedAt).toSeconds()));

        List<ActiveSnapshotTableEntity> tables = active.getTables();
        tables.stream()
                .map(SnapshotHistoryService::toTableHistory)
                .forEach(history::addTable);

        long completedTables = tables.stream()
                .filter(table -> table.getState() == TableState.COMPLETED)
                .count();
        long totalRowsScanned = tables.stream()
                .mapToLong(ActiveSnapshotTableEntity::getRowsScanned)
                .sum();

        history.setTotalTables(tables.size());
        history.setCompletedTables((int) completedTables);
        history.setTotalRowsScanned(totalRowsScanned);

        em.persist(history);
        activeSnapshotService.remove(active);
        return history;
    }

    /**
     * Closes a running snapshot as {@code ABORTED} (a new snapshot started before the previous one
     * finished).
     */
    @Transactional
    public SnapshotHistoryEntity closeAsAborted(Long pipelineId, String pipelineName, Instant when) {
        return historicize(pipelineId, pipelineName, SnapshotState.ABORTED, when);
    }

    /**
     * Retention cleanup: deletes history rows completed before {@code cutoff}. Returns the number of
     * rows removed.
     */
    @Transactional
    public int deleteOlderThan(Instant cutoff) {
        return em.createNamedQuery(SnapshotHistoryEntity.DELETE_OLDER_THAN)
                .setParameter(CUTOFF_PARAMETER, cutoff)
                .executeUpdate();
    }

    /**
     * Paginated, filtered history list ordered by completion time (newest first). Uses the
     * lightweight {@link SnapshotHistorySummary} view (no per-table breakdown) to keep the payload
     * small.
     */
    @Transactional(SUPPORTS)
    public PagedSnapshotHistoryResponse query(Long pipelineId, SnapshotType type, SnapshotState outcome,
                                              Instant from, Instant to, int page, int size) {

        CriteriaBuilder<SnapshotHistoryEntity> criteria = cb();

        if (pipelineId != null) {
            criteria.where(PIPELINE_ID_ATTRIBUTE).eq(pipelineId);
        }
        if (type != null) {
            criteria.where(TYPE_ATTRIBUTE).eq(type);
        }
        if (outcome != null) {
            criteria.where(OUTCOME_ATTRIBUTE).eq(outcome);
        }
        if (from != null) {
            criteria.where(COMPLETED_AT_ATTRIBUTE).ge(from);
        }
        if (to != null) {
            criteria.where(COMPLETED_AT_ATTRIBUTE).le(to);
        }

        criteria.orderByDesc(COMPLETED_AT_ATTRIBUTE);
        criteria.orderByDesc(PRIMARY_KEY_ATTRIBUTE);

        PagedList<SnapshotHistorySummary> result = evm.applySetting(
                EntityViewSetting.create(SnapshotHistorySummary.class, page * size, size), criteria)
                .getResultList();

        List<SnapshotHistoryResponse> items = result.stream()
                .map(SnapshotHistoryService::toResponse)
                .toList();

        return new PagedSnapshotHistoryResponse(items, page, size, result.getTotalSize(), result.getTotalPages());
    }

    /**
     * A single history run with its per-table breakdown.
     */
    @Transactional(SUPPORTS)
    public Optional<SnapshotHistoryResponse> findRunById(Long historyId) {
        return findByIdAs(SnapshotHistory.class, historyId).map(SnapshotHistoryService::toResponse);
    }

    private static SnapshotTableHistoryEntity toTableHistory(ActiveSnapshotTableEntity table) {
        SnapshotTableHistoryEntity entry = new SnapshotTableHistoryEntity();
        entry.setTableName(table.getTableName());
        entry.setOutcome(table.getState());
        entry.setOrderIndex(table.getOrderIndex());
        entry.setRowsScanned(table.getRowsScanned());
        entry.setSkipReason(table.getSkipReason());
        entry.setDurationSeconds(tableDuration(table));
        return entry;
    }

    private static Long tableDuration(ActiveSnapshotTableEntity table) {
        if (table.getStartedAt() == null || table.getCompletedAt() == null) {
            return null;
        }
        return Math.max(0L, Duration.between(table.getStartedAt(), table.getCompletedAt()).toSeconds());
    }

    private static SnapshotHistoryResponse toResponse(SnapshotHistorySummary view) {
        return new SnapshotHistoryResponse(
                view.getId(),
                view.getPipelineId(),
                view.getPipelineName(),
                view.getType(),
                view.getOutcome(),
                view.getTotalTables(),
                view.getCompletedTables(),
                view.getTotalRowsScanned(),
                view.getStartedAt(),
                view.getCompletedAt(),
                view.getDurationSeconds(),
                null);
    }

    private static SnapshotHistoryResponse toResponse(SnapshotHistory view) {
        List<TableHistoryEntry> tables = view.getTables().stream()
                .map(SnapshotHistoryService::toEntry)
                .toList();

        return new SnapshotHistoryResponse(
                view.getId(),
                view.getPipelineId(),
                view.getPipelineName(),
                view.getType(),
                view.getOutcome(),
                view.getTotalTables(),
                view.getCompletedTables(),
                view.getTotalRowsScanned(),
                view.getStartedAt(),
                view.getCompletedAt(),
                view.getDurationSeconds(),
                tables);
    }

    private static TableHistoryEntry toEntry(SnapshotTableHistory view) {
        return new TableHistoryEntry(
                view.getTableName(),
                view.getOutcome(),
                view.getRowsScanned(),
                view.getSkipReason(),
                view.getDurationSeconds());
    }
}
