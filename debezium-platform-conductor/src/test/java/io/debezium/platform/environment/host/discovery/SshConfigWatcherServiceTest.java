/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.discovery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.util.Collections;
import java.util.List;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.model.HostStatusEntity;
import io.debezium.platform.data.model.ProvisioningStatus;
import io.debezium.platform.environment.host.provisioning.HostProvisioningService;

/**
 * Unit tests for the pure reconciliation logic in
 * {@link SshConfigWatcherService#buildReconciliationPlan(List, List)}.
 *
 * <p>These are plain JUnit 5 tests with no {@code @QuarkusTest} — they test only
 * the stateless comparison function, which has zero database access and zero side effects.
 */
class SshConfigWatcherServiceTest {

    private SshConfigWatcherService service;

    @BeforeEach
    void setUp() {
        Logger logger = Logger.getLogger(SshConfigWatcherService.class);
        SshConfigParser parser = new SshConfigParser(Logger.getLogger(SshConfigParser.class));
        HostReconciliationRepository repository = mock(HostReconciliationRepository.class);
        HostProvisioningService provisioning = mock(HostProvisioningService.class);
        service = new SshConfigWatcherService(logger, parser, repository, provisioning);
    }

    @Test
    void testNewHostInFileNotInDb() {
        List<SshHostEntry> fileHosts = List.of(
                new SshHostEntry("db-server-1", "192.168.1.10", "ubuntu", 22, null));
        List<HostStatusEntity> dbHosts = Collections.emptyList();

        ReconciliationPlan plan = service.buildReconciliationPlan(fileHosts, dbHosts);

        assertThat(plan.toAdd()).hasSize(1);
        assertThat(plan.toAdd().get(0).alias()).isEqualTo("db-server-1");
        assertThat(plan.toRemove()).isEmpty();
        assertThat(plan.toUpdate()).isEmpty();
    }

    @Test
    void testHostRemovedFromFile() {
        List<SshHostEntry> fileHosts = Collections.emptyList();
        List<HostStatusEntity> dbHosts = List.of(
                createDbHost("db-server-1", "192.168.1.10", ProvisioningStatus.READY));

        ReconciliationPlan plan = service.buildReconciliationPlan(fileHosts, dbHosts);

        assertThat(plan.toRemove()).containsExactly("db-server-1");
        assertThat(plan.toAdd()).isEmpty();
        assertThat(plan.toUpdate()).isEmpty();
    }

    @Test
    void testHostUnchanged() {
        List<SshHostEntry> fileHosts = List.of(
                new SshHostEntry("db-server-1", "192.168.1.10", "ubuntu", 22, null));
        List<HostStatusEntity> dbHosts = List.of(
                createDbHost("db-server-1", "192.168.1.10", ProvisioningStatus.READY));

        ReconciliationPlan plan = service.buildReconciliationPlan(fileHosts, dbHosts);

        assertThat(plan.toAdd()).isEmpty();
        assertThat(plan.toRemove()).isEmpty();
        assertThat(plan.toUpdate()).isEmpty();
    }

    @Test
    void testHostHostnameChanged() {
        List<SshHostEntry> fileHosts = List.of(
                new SshHostEntry("db-server-1", "10.0.0.99", "ubuntu", 22, null));
        List<HostStatusEntity> dbHosts = List.of(
                createDbHost("db-server-1", "192.168.1.10", ProvisioningStatus.READY));

        ReconciliationPlan plan = service.buildReconciliationPlan(fileHosts, dbHosts);

        assertThat(plan.toUpdate()).hasSize(1);
        assertThat(plan.toUpdate().get(0).alias()).isEqualTo("db-server-1");
        assertThat(plan.toUpdate().get(0).hostname()).isEqualTo("10.0.0.99");
        assertThat(plan.toAdd()).isEmpty();
        assertThat(plan.toRemove()).isEmpty();
    }

    @Test
    void testMixedScenario() {
        List<SshHostEntry> fileHosts = List.of(
                new SshHostEntry("new-host", "10.0.0.1", "admin", 22, null),
                new SshHostEntry("unchanged-host", "10.0.0.2", "deploy", 22, null),
                new SshHostEntry("changed-host", "10.0.0.99", "ubuntu", 22, null));
        List<HostStatusEntity> dbHosts = List.of(
                createDbHost("unchanged-host", "10.0.0.2", ProvisioningStatus.READY),
                createDbHost("changed-host", "10.0.0.3", ProvisioningStatus.READY),
                createDbHost("removed-host", "10.0.0.4", ProvisioningStatus.READY));

        ReconciliationPlan plan = service.buildReconciliationPlan(fileHosts, dbHosts);

        assertThat(plan.toAdd()).hasSize(1);
        assertThat(plan.toAdd().get(0).alias()).isEqualTo("new-host");
        assertThat(plan.toRemove()).containsExactly("removed-host");
        assertThat(plan.toUpdate()).hasSize(1);
        assertThat(plan.toUpdate().get(0).alias()).isEqualTo("changed-host");
    }

    @Test
    void testEmptyFileEmptyDb() {
        ReconciliationPlan plan = service.buildReconciliationPlan(
                Collections.emptyList(), Collections.emptyList());

        assertThat(plan.toAdd()).isEmpty();
        assertThat(plan.toRemove()).isEmpty();
        assertThat(plan.toUpdate()).isEmpty();
    }

    @Test
    void testHostWithNullHostnameUsesAliasForComparison() {
        List<SshHostEntry> fileHosts = List.of(
                new SshHostEntry("db-server-1", null, "ubuntu", 22, null));
        List<HostStatusEntity> dbHosts = List.of(
                createDbHost("db-server-1", "db-server-1", ProvisioningStatus.READY));

        ReconciliationPlan plan = service.buildReconciliationPlan(fileHosts, dbHosts);

        assertThat(plan.toAdd()).isEmpty();
        assertThat(plan.toRemove()).isEmpty();
        assertThat(plan.toUpdate()).isEmpty();
    }

    /**
     * Creates a {@link HostStatusEntity} for test purposes.
     */
    private HostStatusEntity createDbHost(String alias, String hostname,
                                          ProvisioningStatus status) {
        HostStatusEntity entity = new HostStatusEntity();
        entity.setSshAlias(alias);
        entity.setHostname(hostname);
        entity.setProvisioningStatus(status);
        return entity;
    }
}
