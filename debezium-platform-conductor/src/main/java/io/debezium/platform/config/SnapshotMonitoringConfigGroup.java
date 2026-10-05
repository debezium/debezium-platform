/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import java.time.Duration;

import io.quarkus.runtime.annotations.ConfigPhase;
import io.quarkus.runtime.annotations.ConfigRoot;
import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.smallrye.config.WithName;

/**
 * Configuration for the snapshot monitoring feature (DDD-68). Mirrors the structure of
 * {@link AlertingConfigGroup}.
 */
@ConfigMapping(prefix = "snapshot.monitoring")
@ConfigRoot(phase = ConfigPhase.RUN_TIME)
public interface SnapshotMonitoringConfigGroup {

    SseConfigGroup sse();

    HistoryConfigGroup history();

    NotificationConfigGroup notification();

    WatchdogConfigGroup watchdog();

    interface SseConfigGroup {

        @WithDefault("1s")
        Duration debounce();
    }

    interface HistoryConfigGroup {

        @WithDefault("30d")
        Duration retention();
    }

    /**
     * Values used by {@code PipelineMapper} to build the callback URL injected into the Debezium
     * Server CR, plus the retry/timeout hints passed to the HTTP notification channel.
     */
    interface NotificationConfigGroup {

        @WithDefault("conductor")
        @WithName("service-name")
        String serviceName();

        @WithDefault("8080")
        int port();

        @WithDefault("log,http")
        String channels();

        @WithDefault("5000")
        @WithName("timeout-ms")
        int timeoutMs();

        @WithDefault("2")
        int retries();
    }

    /**
     * Staleness watchdog: closes active snapshots that stopped receiving updates as {@code UNKNOWN}.
     */
    interface WatchdogConfigGroup {

        @WithDefault("1h")
        @WithName("stale-timeout")
        Duration staleTimeout();

        /**
         * How often chunk progress is written back to the active snapshot row to refresh its
         * last-updated timestamp. Chunk notifications arrive far more often than that, and the write
         * only exists so {@link #staleTimeout()} does not fire on a snapshot that is merely scanning a
         * large table, so it is throttled to this interval. Must stay well below the stale timeout.
         */
        @WithDefault("30s")
        Duration heartbeat();
    }
}
