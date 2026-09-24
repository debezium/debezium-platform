/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.snapshot;

import java.time.Clock;
import java.time.Instant;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import org.jboss.logging.Logger;

import io.debezium.platform.config.SnapshotMonitoringConfigGroup;
import io.debezium.platform.domain.SnapshotHistoryService;
import io.quarkus.scheduler.Scheduled;

/**
 * Retention cleanup for snapshot history (DDD-68). Periodically deletes history rows completed
 * before the configured retention window. Mirrors {@code AlertHistoryCleanup}.
 */
@ApplicationScoped
public class SnapshotHistoryCleanup {

    private static final Logger LOGGER = Logger.getLogger(SnapshotHistoryCleanup.class);

    private final SnapshotMonitoringConfigGroup.HistoryConfigGroup historyConfig;
    private final SnapshotHistoryService historyService;
    private final Clock clock;

    @Inject
    public SnapshotHistoryCleanup(SnapshotMonitoringConfigGroup config, SnapshotHistoryService historyService) {
        this(config, historyService, Clock.systemUTC());
    }

    SnapshotHistoryCleanup(SnapshotMonitoringConfigGroup config, SnapshotHistoryService historyService, Clock clock) {
        this.historyConfig = config.history();
        this.historyService = historyService;
        this.clock = clock;
    }

    @Scheduled(every = "${snapshot.monitoring.history.cleanup.interval:24h}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void cleanup() {
        Instant cutoff = Instant.now(clock).minus(historyConfig.retention());
        int deleted = historyService.deleteOlderThan(cutoff);
        if (deleted > 0) {
            LOGGER.infov("Cleaned up {0} snapshot history record(s) older than {1}", deleted, cutoff);
        }
    }
}
