/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.snapshot;

import java.time.Instant;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

import io.debezium.platform.config.SnapshotMonitoringConfigGroup;
import io.quarkus.scheduler.Scheduled;

/**
 * Closes snapshots that stopped receiving notifications (e.g. a Debezium Server crash) as
 * {@code UNKNOWN} so they do not linger as perpetually "running" (DDD-68). Delegates to
 * {@link SnapshotProgressAggregator#closeStaleSnapshots} so the transition runs under the same
 * per-pipeline lock and is broadcast to SSE subscribers.
 */
@ApplicationScoped
public class SnapshotStalenessWatchdog {

    private static final Logger LOGGER = Logger.getLogger(SnapshotStalenessWatchdog.class);

    private final SnapshotMonitoringConfigGroup.WatchdogConfigGroup watchdogConfig;
    private final SnapshotProgressAggregator aggregator;

    public SnapshotStalenessWatchdog(SnapshotMonitoringConfigGroup config, SnapshotProgressAggregator aggregator) {
        this.watchdogConfig = config.watchdog();
        this.aggregator = aggregator;
    }

    @Scheduled(every = "${snapshot.monitoring.watchdog.check-interval:15m}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void checkForStaleSnapshots() {
        Instant now = Instant.now();
        Instant cutoff = now.minus(watchdogConfig.staleTimeout());
        int closed = aggregator.closeStaleSnapshots(cutoff, now);
        if (closed > 0) {
            LOGGER.warnv("Closed {0} stale snapshot(s) as UNKNOWN (no update since before {1})", closed, cutoff);
        }
    }
}
