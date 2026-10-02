/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

/**
 * Per-table outcome of a completed snapshot run, child of {@link SnapshotHistoryEntity}.
 */
@Entity(name = "snapshot_table_history")
public class SnapshotTableHistoryEntity {

    @Id
    @GeneratedValue
    private Long id;

    @ManyToOne
    @JoinColumn(name = "snapshot_history_id", nullable = false)
    private SnapshotHistoryEntity snapshotHistory;

    @Column(name = "table_name", nullable = false, length = 512)
    private String tableName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TableState outcome;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @Column(name = "rows_scanned", nullable = false)
    private long rowsScanned;

    @Column(name = "skip_reason")
    private String skipReason;

    @Column(name = "duration_seconds")
    private Long durationSeconds;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public SnapshotHistoryEntity getSnapshotHistory() {
        return snapshotHistory;
    }

    public void setSnapshotHistory(SnapshotHistoryEntity snapshotHistory) {
        this.snapshotHistory = snapshotHistory;
    }

    public String getTableName() {
        return tableName;
    }

    public void setTableName(String tableName) {
        this.tableName = tableName;
    }

    public TableState getOutcome() {
        return outcome;
    }

    public void setOutcome(TableState outcome) {
        this.outcome = outcome;
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

    public Long getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Long durationSeconds) {
        this.durationSeconds = durationSeconds;
    }
}
