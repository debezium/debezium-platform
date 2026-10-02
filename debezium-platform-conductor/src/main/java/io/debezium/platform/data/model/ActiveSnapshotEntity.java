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
 * Structural state of the snapshot currently running for a pipeline. At most one active snapshot
 * exists per pipeline (enforced by the unique {@code pipeline_id} column). Survives a Conductor
 * restart; high-frequency chunk progress is kept in memory (not here). See DDD-68.
 */
@Entity(name = "active_snapshot")
@NamedQuery(name = ActiveSnapshotEntity.FIND_BY_PIPELINE_ID, query = "SELECT a FROM active_snapshot a WHERE a.pipelineId = :pipelineId")
public class ActiveSnapshotEntity {

    public static final String FIND_BY_PIPELINE_ID = "ActiveSnapshot.findByPipelineId";

    @Id
    @GeneratedValue
    private Long id;

    @Column(name = "pipeline_id", nullable = false, unique = true)
    private Long pipelineId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SnapshotType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SnapshotState status;

    @Column(name = "correlation_id")
    private String correlationId;

    @Column(name = "total_tables", nullable = false)
    private int totalTables;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "last_updated_at", nullable = false)
    private Instant lastUpdatedAt;

    @OneToMany(mappedBy = "activeSnapshot", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<ActiveSnapshotTableEntity> tables = new ArrayList<>();

    public void addTable(ActiveSnapshotTableEntity table) {
        table.setActiveSnapshot(this);
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

    public SnapshotType getType() {
        return type;
    }

    public void setType(SnapshotType type) {
        this.type = type;
    }

    public SnapshotState getStatus() {
        return status;
    }

    public void setStatus(SnapshotState status) {
        this.status = status;
    }

    public String getCorrelationId() {
        return correlationId;
    }

    public void setCorrelationId(String correlationId) {
        this.correlationId = correlationId;
    }

    public int getTotalTables() {
        return totalTables;
    }

    public void setTotalTables(int totalTables) {
        this.totalTables = totalTables;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getLastUpdatedAt() {
        return lastUpdatedAt;
    }

    public void setLastUpdatedAt(Instant lastUpdatedAt) {
        this.lastUpdatedAt = lastUpdatedAt;
    }

    public List<ActiveSnapshotTableEntity> getTables() {
        return tables;
    }

    public void setTables(List<ActiveSnapshotTableEntity> tables) {
        this.tables = tables;
    }
}
