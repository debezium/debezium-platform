/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.snapshot;

import java.time.Instant;

/**
 * Immutable snapshot of the latest chunk state of a single in-progress table (DDD-68).
 * One instance per table currently being scanned; the owning table name is the key in
 * {@link ChunkProgressTracker}'s per-pipeline map, which documents the lifecycle (never persisted,
 * rebuilt after a restart) and the concurrency contract (the map is mutated only under the
 * aggregator's per-pipeline lock).
 */
record ChunkOverlay(Integer chunkNumber, Integer completedChunks, Integer totalChunks, long rowsScanned,
        Instant lastUpdatedAt) {
}
