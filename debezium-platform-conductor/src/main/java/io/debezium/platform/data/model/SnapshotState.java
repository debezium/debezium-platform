/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

/**
 * Platform-level snapshot lifecycle state (see DDD-68).
 * <p>
 * {@link #IDLE} is a transient view-model value only, used when no snapshot is active for a
 * pipeline; it is never persisted. {@link #UNKNOWN} is assigned by the staleness watchdog when a
 * running snapshot stops receiving updates: first as a revivable flag on the still-active row (a late
 * notification restores it to {@link #RUNNING}), and, if it stays stale, as the terminal history
 * outcome when the run is finalized.
 */
public enum SnapshotState {

    IDLE,
    RUNNING,
    PAUSED,
    COMPLETED,
    ABORTED,
    SKIPPED,
    UNKNOWN
}
