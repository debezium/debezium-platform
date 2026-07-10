/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.discovery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.debezium.platform.domain.views.HostStatus;

/**
 * Unit tests for the pure reconciliation logic in
 * {@link HostReconciliationPlanBuilder#buildPlan(List, List)}.
 *
 * <p>These are plain JUnit 5 tests with no {@code @QuarkusTest} — they test only
 * the stateless comparison function, which has zero database access and zero side effects.
 */
class HostReconciliationPlanBuilderTest {

    private HostReconciliationPlanBuilder planBuilder;

    @BeforeEach
    void setUp() {
        planBuilder = new HostReconciliationPlanBuilder();
    }

    @Test
    void testNewHostInFileNotInDb() {
        List<SshHostEntry> fileHosts = List.of(
                new SshHostEntry("db-server-1", "192.168.1.10", "ubuntu", 22, null));
        List<HostStatus> dbHosts = Collections.emptyList();

        ReconciliationPlan plan = planBuilder.buildPlan(fileHosts, dbHosts);

        assertThat(plan.toAdd()).hasSize(1);
        assertThat(plan.toAdd().get(0).alias()).isEqualTo("db-server-1");
        assertThat(plan.toRemove()).isEmpty();
        assertThat(plan.toUpdate()).isEmpty();
    }

    @Test
    void testHostRemovedFromFile() {
        List<SshHostEntry> fileHosts = Collections.emptyList();
        List<HostStatus> dbHosts = List.of(
                mockHostView("db-server-1", "192.168.1.10"));

        ReconciliationPlan plan = planBuilder.buildPlan(fileHosts, dbHosts);

        assertThat(plan.toRemove()).containsExactly("db-server-1");
        assertThat(plan.toAdd()).isEmpty();
        assertThat(plan.toUpdate()).isEmpty();
    }

    @Test
    void testHostUnchanged() {
        List<SshHostEntry> fileHosts = List.of(
                new SshHostEntry("db-server-1", "192.168.1.10", "ubuntu", 22, null));
        List<HostStatus> dbHosts = List.of(
                mockHostView("db-server-1", "192.168.1.10"));

        ReconciliationPlan plan = planBuilder.buildPlan(fileHosts, dbHosts);

        assertThat(plan.toAdd()).isEmpty();
        assertThat(plan.toRemove()).isEmpty();
        assertThat(plan.toUpdate()).isEmpty();
    }

    @Test
    void testHostHostnameChanged() {
        List<SshHostEntry> fileHosts = List.of(
                new SshHostEntry("db-server-1", "10.0.0.99", "ubuntu", 22, null));
        List<HostStatus> dbHosts = List.of(
                mockHostView("db-server-1", "192.168.1.10"));

        ReconciliationPlan plan = planBuilder.buildPlan(fileHosts, dbHosts);

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
        List<HostStatus> dbHosts = List.of(
                mockHostView("unchanged-host", "10.0.0.2"),
                mockHostView("changed-host", "10.0.0.3"),
                mockHostView("removed-host", "10.0.0.4"));

        ReconciliationPlan plan = planBuilder.buildPlan(fileHosts, dbHosts);

        assertThat(plan.toAdd()).hasSize(1);
        assertThat(plan.toAdd().get(0).alias()).isEqualTo("new-host");
        assertThat(plan.toRemove()).containsExactly("removed-host");
        assertThat(plan.toUpdate()).hasSize(1);
        assertThat(plan.toUpdate().get(0).alias()).isEqualTo("changed-host");
    }

    @Test
    void testEmptyFileEmptyDb() {
        ReconciliationPlan plan = planBuilder.buildPlan(
                Collections.emptyList(), Collections.emptyList());

        assertThat(plan.toAdd()).isEmpty();
        assertThat(plan.toRemove()).isEmpty();
        assertThat(plan.toUpdate()).isEmpty();
    }

    @Test
    void testHostWithNullHostnameUsesAliasForComparison() {
        List<SshHostEntry> fileHosts = List.of(
                new SshHostEntry("db-server-1", null, "ubuntu", 22, null));
        List<HostStatus> dbHosts = List.of(
                mockHostView("db-server-1", "db-server-1"));

        ReconciliationPlan plan = planBuilder.buildPlan(fileHosts, dbHosts);

        assertThat(plan.toAdd()).isEmpty();
        assertThat(plan.toRemove()).isEmpty();
        assertThat(plan.toUpdate()).isEmpty();
    }

    /**
     * Creates a mocked {@link HostStatus} entity view for test purposes.
     * Only stubs the two getters used by the pure reconciliation function:
     * {@code getSshAlias()} and {@code getHostname()}.
     */
    private HostStatus mockHostView(String alias, String hostname) {
        HostStatus host = mock(HostStatus.class);
        when(host.getSshAlias()).thenReturn(alias);
        when(host.getHostname()).thenReturn(hostname);
        return host;
    }
}
