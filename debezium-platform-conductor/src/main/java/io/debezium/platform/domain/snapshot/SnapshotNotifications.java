/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.snapshot;

import io.debezium.connector.SnapshotType;
import io.debezium.platform.data.model.TableState;

/**
 * Central vocabulary for the Debezium snapshot {@code Notification} model (DDD-68), so the
 * aggregator never sprinkles raw string literals. Holds the {@code aggregateType} values, the
 * notification {@code type} values, the {@code additionalData} keys, and the mappings from Debezium
 * strings to the platform {@link SnapshotType}/{@link TableState} taxonomy.
 */
public final class SnapshotNotifications {

    // aggregateType values
    public static final String AGG_INITIAL = "Initial Snapshot";
    public static final String AGG_INCREMENTAL = "Incremental Snapshot";

    // notification type (SnapshotStatus enum, serialized as the notification "type")
    public static final String STARTED = "STARTED";
    public static final String DATA_COLLECTIONS_RESOLVED = "DATA_COLLECTIONS_RESOLVED";
    public static final String IN_PROGRESS = "IN_PROGRESS";
    public static final String TABLE_CHUNK_IN_PROGRESS = "TABLE_CHUNK_IN_PROGRESS";
    public static final String TABLE_CHUNK_COMPLETED = "TABLE_CHUNK_COMPLETED";
    public static final String TABLE_SCAN_COMPLETED = "TABLE_SCAN_COMPLETED";
    public static final String PAUSED = "PAUSED";
    public static final String RESUMED = "RESUMED";
    public static final String COMPLETED = "COMPLETED";
    public static final String ABORTED = "ABORTED";
    public static final String SKIPPED = "SKIPPED";

    // additionalData keys
    public static final String K_DATA_COLLECTIONS = "data_collections";
    public static final String K_CURRENT_COLLECTION = "current_collection_in_progress";
    public static final String K_SCANNED_COLLECTION = "scanned_collection";
    public static final String K_CHUNK_INDEX = "chunk_index";
    public static final String K_TOTAL_CHUNKS = "total_chunks";
    public static final String K_ROWS_SCANNED = "total_rows_scanned";
    public static final String K_STATUS = "status";

    // table-scan status values (additionalData "status" on TABLE_SCAN_COMPLETED)
    private static final String STATUS_SUCCEEDED = "SUCCEEDED";
    private static final String STATUS_EMPTY = "EMPTY";
    private static final String STATUS_NO_PRIMARY_KEY = "NO_PRIMARY_KEY";
    private static final String STATUS_UNKNOWN_SCHEMA = "UNKNOWN_SCHEMA";
    private static final String STATUS_SKIPPED = "SKIPPED";
    private static final String STATUS_SQL_EXCEPTION = "SQL_EXCEPTION";

    private SnapshotNotifications() {
    }

    /**
     * True when the notification belongs to a snapshot (initial or incremental); other notifications
     * are ignored by the aggregator.
     */
    public static boolean isSnapshotAggregate(String aggregateType) {
        return AGG_INITIAL.equals(aggregateType) || AGG_INCREMENTAL.equals(aggregateType);
    }

    /**
     * Maps the notification {@code aggregateType} to the reused core {@link SnapshotType}. A blocking
     * snapshot runs through the initial code path and reports {@code "Initial Snapshot"}, so only
     * {@code INITIAL}/{@code INCREMENTAL} are ever observed over notifications.
     */
    public static SnapshotType typeOf(String aggregateType) {
        return AGG_INCREMENTAL.equals(aggregateType) ? SnapshotType.INCREMENTAL : SnapshotType.INITIAL;
    }

    /**
     * Maps the Debezium table-scan {@code status} to a platform {@link TableState} plus a
     * human-readable skip/failure reason (null when the table completed normally).
     */
    public static TableOutcome toTableOutcome(String status) {
        if (status == null) {
            return new TableOutcome(TableState.COMPLETED, null);
        }
        return switch (status.toUpperCase()) {
            case STATUS_SUCCEEDED -> new TableOutcome(TableState.COMPLETED, null);
            case STATUS_EMPTY -> new TableOutcome(TableState.SKIPPED, "Table is empty");
            case STATUS_NO_PRIMARY_KEY -> new TableOutcome(TableState.SKIPPED, "No primary key");
            case STATUS_UNKNOWN_SCHEMA -> new TableOutcome(TableState.SKIPPED, "Unknown schema");
            case STATUS_SKIPPED -> new TableOutcome(TableState.SKIPPED, "Skipped");
            case STATUS_SQL_EXCEPTION -> new TableOutcome(TableState.FAILED, "SQL exception");
            default -> new TableOutcome(TableState.COMPLETED, null);
        };
    }

    /**
     * Terminal per-table outcome derived from a {@code TABLE_SCAN_COMPLETED} status.
     */
    public record TableOutcome(TableState state, String reason) {
    }
}
