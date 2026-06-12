/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import jakarta.inject.Inject;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.shaded.org.awaitility.Awaitility;

import io.agroal.api.AgroalDataSource;
import io.debezium.platform.HeartbeatTestProfile;
import io.debezium.platform.environment.operator.actions.DebeziumKubernetesAdapter;
import io.fabric8.kubernetes.client.server.mock.EnableKubernetesMockClient;
import io.quarkus.arc.InjectableInstance;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@TestProfile(HeartbeatTestProfile.class)
@EnableKubernetesMockClient(crud = true)
class HeartbeatWalAdvancementIT {

    @Inject
    InjectableInstance<AgroalDataSource> dataSource;

    @InjectMock
    DebeziumKubernetesAdapter k8sAdapter;

    @Test
    @DisplayName("Heartbeat should cause the replication slot confirmed_flush_lsn to advance")
    void heartbeatShouldAdvanceReplicationSlotLsn() throws Exception {
        var initialLsn = new AtomicReference<String>();

        Awaitility.await()
                .alias("replication slot should be created")
                .atMost(30, TimeUnit.SECONDS)
                .pollInterval(1, TimeUnit.SECONDS)
                .untilAsserted(() -> {
                    try (Connection conn = dataSource.get().getConnection();
                            Statement stmt = conn.createStatement();
                            ResultSet rs = stmt.executeQuery("""
                                    SELECT confirmed_flush_lsn
                                    FROM pg_replication_slots
                                    WHERE slot_name = 'debezium'
                                    """)) {
                        assertThat(rs.next())
                                .as("Replication slot 'debezium' should exist")
                                .isTrue();
                        initialLsn.set(rs.getString("confirmed_flush_lsn"));
                        assertThat(initialLsn.get()).isNotNull();
                    }
                });

        Awaitility.await()
                .alias("heartbeat row should be inserted")
                .atMost(30, TimeUnit.SECONDS)
                .pollInterval(1, TimeUnit.SECONDS)
                .untilAsserted(() -> {
                    try (Connection conn = dataSource.get().getConnection();
                            Statement stmt = conn.createStatement();
                            ResultSet rs = stmt.executeQuery("SELECT id FROM heartbeat WHERE id = 1")) {
                        assertThat(rs.next())
                                .as("Heartbeat row should exist")
                                .isTrue();
                    }
                });

        Awaitility.await()
                .alias("confirmed_flush_lsn should advance past initial value")
                .atMost(60, TimeUnit.SECONDS)
                .pollInterval(2, TimeUnit.SECONDS)
                .untilAsserted(() -> {
                    try (Connection conn = dataSource.get().getConnection();
                            Statement stmt = conn.createStatement();
                            ResultSet rs = stmt.executeQuery("""
                                    SELECT confirmed_flush_lsn
                                    FROM pg_replication_slots
                                    WHERE slot_name = 'debezium'
                                    """)) {
                        assertThat(rs.next()).isTrue();
                        var currentLsn = rs.getString("confirmed_flush_lsn");
                        assertThat(currentLsn)
                                .as("confirmed_flush_lsn should advance from %s", initialLsn.get())
                                .isNotEqualTo(initialLsn.get());
                    }
                });
    }
}
