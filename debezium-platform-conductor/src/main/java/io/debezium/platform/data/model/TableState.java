/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

/**
 * Per-table state within a snapshot (see DDD-68).
 */
public enum TableState {

    PENDING,
    IN_PROGRESS,
    COMPLETED,
    SKIPPED,
    FAILED
}
