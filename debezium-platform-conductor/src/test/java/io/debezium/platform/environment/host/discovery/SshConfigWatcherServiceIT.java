/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.discovery;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.util.List;

import jakarta.inject.Inject;

import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import io.debezium.platform.data.model.ProvisioningStatus;
import io.debezium.platform.domain.HostStatusService;
import io.debezium.platform.domain.views.HostStatus;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

/**
 * Integration test for {@link SshConfigWatcherService}.
 *
 * <p>Boots a full Quarkus application in host mode with a temporary SSH config
 * file. Verifies the watcher's startup reconciliation, file-change detection,
 * and host removal lifecycle end-to-end against the real database.
 *
 * <p>After modifying the temp SSH config file, tests invoke
 * {@link SshConfigWatcherService#scheduledReconciliation()} directly rather
 * than waiting for the OS-level {@link java.nio.file.WatchService} to detect
 * the change. This avoids platform-specific timing issues (macOS's WatchService
 * uses generic polling with ~10s delays) while still exercising the full
 * parse → diff → persist pipeline end-to-end.
 *
 * <p>Tests are ordered because they modify shared state (the temp SSH config
 * file and the database). Each test builds on the state left by the previous one.
 */
@QuarkusTest
@TestProfile(SshConfigWatcherTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SshConfigWatcherServiceIT {

    @Inject
    HostStatusService hostStatusService;

    @Inject
    SshConfigWatcherService watcherService;

    @org.eclipse.microprofile.config.inject.ConfigProperty(name = "debezium.host.ssh-config-path")
    String sshConfigPath;

    @Test
    @Order(1)
    public void shouldReconcileOnStartup() {
        List<HostStatus> hosts = hostStatusService.findAllActiveHosts();

        assertThat(hosts)
                .as("Startup reconciliation should create entries for the 2 hosts in the temp SSH config")
                .hasSize(2);

        assertThat(hosts)
                .extracting(HostStatus::getSshAlias)
                .containsExactlyInAnyOrder("db-server-1", "db-server-2");

        assertThat(hosts)
                .extracting(HostStatus::getProvisioningStatus)
                .containsOnly(ProvisioningStatus.PENDING);
    }

    @Test
    @Order(2)
    public void shouldDetectNewHostAddedToFile() throws IOException {
        Files.writeString(java.nio.file.Path.of(sshConfigPath),
                """
                        Host db-server-1
                            HostName 192.168.1.10
                            User ubuntu

                        Host db-server-2
                            HostName 192.168.1.20
                            User deploy

                        Host db-server-3
                            HostName 10.0.0.50
                            User admin
                        """);

        watcherService.scheduledReconciliation();

        List<HostStatus> hosts = hostStatusService.findAllActiveHosts();

        assertThat(hosts)
                .as("After adding db-server-3 to the file, there should be 3 active hosts")
                .hasSize(3);

        assertThat(hosts)
                .extracting(HostStatus::getSshAlias)
                .containsExactlyInAnyOrder("db-server-1", "db-server-2", "db-server-3");
    }

    @Test
    @Order(3)
    public void shouldMarkRemovedHostWhenDeletedFromFile() throws IOException {
        Files.writeString(java.nio.file.Path.of(sshConfigPath),
                """
                        Host db-server-1
                            HostName 192.168.1.10
                            User ubuntu

                        Host db-server-3
                            HostName 10.0.0.50
                            User admin
                        """);

        watcherService.scheduledReconciliation();

        List<HostStatus> activeHosts = hostStatusService.findAllActiveHosts();

        assertThat(activeHosts)
                .as("After removing db-server-2 from the file, only 2 hosts should be active")
                .hasSize(2);

        assertThat(activeHosts)
                .extracting(HostStatus::getSshAlias)
                .containsExactlyInAnyOrder("db-server-1", "db-server-3");

        assertThat(hostStatusService.findBySshAlias("db-server-2"))
                .as("db-server-2 should still exist in the DB but marked as REMOVED")
                .isPresent()
                .get()
                .extracting(HostStatus::getProvisioningStatus)
                .isEqualTo(ProvisioningStatus.REMOVED);
    }
}
