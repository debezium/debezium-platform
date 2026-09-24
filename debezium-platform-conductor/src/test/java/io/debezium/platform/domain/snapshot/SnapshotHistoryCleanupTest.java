/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.snapshot;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import io.debezium.doc.FixFor;
import io.debezium.platform.config.SnapshotMonitoringConfigGroup;
import io.debezium.platform.domain.SnapshotHistoryService;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SnapshotHistoryCleanupTest {

    private static final Instant NOW = Instant.parse("2026-09-22T12:00:00Z");
    private static final Clock FIXED_CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    SnapshotMonitoringConfigGroup config;

    @Mock
    SnapshotHistoryService historyService;

    @Test
    @FixFor("debezium/dbz#2536")
    void cleanupDeletesUsingRetentionRelativeToClock() {
        Duration retention = Duration.ofDays(30);
        when(config.history().retention()).thenReturn(retention);
        when(historyService.deleteOlderThan(NOW.minus(retention))).thenReturn(3);

        SnapshotHistoryCleanup cleanup = new SnapshotHistoryCleanup(config, historyService, FIXED_CLOCK);
        cleanup.cleanup();

        verify(historyService).deleteOlderThan(NOW.minus(retention));
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void cleanupUsesConfiguredRetentionWindow() {
        Duration retention = Duration.ofHours(6);
        when(config.history().retention()).thenReturn(retention);

        SnapshotHistoryCleanup cleanup = new SnapshotHistoryCleanup(config, historyService, FIXED_CLOCK);
        cleanup.cleanup();

        verify(historyService).deleteOlderThan(Instant.parse("2026-09-22T06:00:00Z"));
    }
}
