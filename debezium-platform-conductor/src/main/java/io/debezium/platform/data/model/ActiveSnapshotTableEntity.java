/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

/**
 * One table within an {@link ActiveSnapshotEntity}. Rows are created up front (as {@code PENDING})
 * when the table list is known, or back-filled lazily when it is not.
 */
@Entity(name = "active_snapshot_table")
public class ActiveSnapshotTableEntity {

    @Id
    @GeneratedValue
    private Long id;

    @ManyToOne
    @JoinColumn(name = "active_snapshot_id", nullable = false)
    private ActiveSnapshotEntity activeSnapshot;

    @Column(name = "table_name", nullable = false, length = 512)
    private String tableName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TableState state;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @Column(name = "rows_scanned", nullable = false)
    private long rowsScanned;

    @Column(name = "skip_reason")
    private String skipReason;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public ActiveSnapshotEntity getActiveSnapshot() {
        return activeSnapshot;
    }

    public void setActiveSnapshot(ActiveSnapshotEntity activeSnapshot) {
        this.activeSnapshot = activeSnapshot;
    }

    public String getTableName() {
        return tableName;
    }

    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    public TableState getState() {
        return state;
    }

    public void setState(TableState state) {
        this.state = state;
    }

    public int getOrderIndex() {
        return orderIndex;
    }

    public void setOrderIndex(int orderIndex) {
        this.orderIndex = orderIndex;
    }

    public long getRowsScanned() {
        return rowsScanned;
    }

    public void setRowsScanned(long rowsScanned) {
        this.rowsScanned = rowsScanned;
    }

    public String getSkipReason() {
        return skipReason;
    }

    public void setSkipReason(String skipReason) {
        this.skipReason = skipReason;
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
}
