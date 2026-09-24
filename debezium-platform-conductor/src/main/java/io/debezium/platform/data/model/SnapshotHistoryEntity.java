/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.NamedQuery;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;

import io.debezium.connector.SnapshotType;

/**
 * A completed (or aborted/skipped/unknown) snapshot run, retained for the configured retention
 * window. Append-only: a row is created when an active snapshot reaches a terminal state and is
 * removed only by retention cleanup. {@code pipelineName} is denormalized so history stays readable
 * after the pipeline is deleted. See DDD-68.
 */
@Entity(name = "snapshot_history")
@NamedQuery(name = SnapshotHistoryEntity.DELETE_OLDER_THAN, query = "DELETE FROM snapshot_history h WHERE h.completedAt < :cutoff")
public class SnapshotHistoryEntity {

    public static final String DELETE_OLDER_THAN = "SnapshotHistory.deleteOlderThan";

    @Id
    @GeneratedValue
    private Long id;

    @Column(name = "pipeline_id", nullable = false)
    private Long pipelineId;

    @Column(name = "pipeline_name")
    private String pipelineName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SnapshotType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SnapshotState outcome;

    @Column(name = "total_tables", nullable = false)
    private int totalTables;

    @Column(name = "completed_tables", nullable = false)
    private int completedTables;

    @Column(name = "total_rows_scanned", nullable = false)
    private long totalRowsScanned;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    @Column(name = "duration_seconds", nullable = false)
    private long durationSeconds;

    @OneToMany(mappedBy = "snapshotHistory", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<SnapshotTableHistoryEntity> tables = new ArrayList<>();

    public void addTable(SnapshotTableHistoryEntity table) {
        table.setSnapshotHistory(this);
        this.tables.add(table);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getPipelineId() {
        return pipelineId;
    }

    public void setPipelineId(Long pipelineId) {
        this.pipelineId = pipelineId;
    }

    public String getPipelineName() {
        return pipelineName;
    }

    public void setPipelineName(String pipelineName) {
        this.pipelineName = pipelineName;
    }

    public SnapshotType getType() {
        return type;
    }

    public void setType(SnapshotType type) {
        this.type = type;
    }

    public SnapshotState getOutcome() {
        return outcome;
    }

    public void setOutcome(SnapshotState outcome) {
        this.outcome = outcome;
    }

    public int getTotalTables() {
        return totalTables;
    }

    public void setTotalTables(int totalTables) {
        this.totalTables = totalTables;
    }

    public int getCompletedTables() {
        return completedTables;
    }

    public void setCompletedTables(int completedTables) {
        this.completedTables = completedTables;
    }

    public long getTotalRowsScanned() {
        return totalRowsScanned;
    }

    public void setTotalRowsScanned(long totalRowsScanned) {
        this.totalRowsScanned = totalRowsScanned;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public long getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(long durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    public List<SnapshotTableHistoryEntity> getTables() {
        return tables;
    }

    public void setTables(List<SnapshotTableHistoryEntity> tables) {
        this.tables = tables;
    }
}
