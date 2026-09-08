/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.debezium.DebeziumException;
import io.debezium.platform.data.model.DeploymentStatus;
import io.debezium.platform.domain.HostDeploymentService;
import io.debezium.platform.domain.views.HostDeployment;
import io.debezium.platform.environment.host.agent.AgentContainerStatus;
import io.debezium.platform.environment.host.agent.HostAgentClient;
import io.debezium.platform.environment.host.config.HostConfigGroup;
import io.debezium.platform.environment.host.provisioning.AnsibleCommandRunner;
import io.debezium.platform.environment.host.provisioning.CommandResult;

/**
 * Unit tests for {@link HostDeploymentStatusPoller}.
 *
 * <p>Verifies all state transition scenarios using the Agent REST API:
 * <ul>
 *   <li>{@code DEPLOYING → RUNNING} when Agent confirms container running</li>
 *   <li>{@code DEPLOYING → FAILED} when container not running after deploy</li>
 *   <li>{@code RUNNING → FAILED} when container stopped unexpectedly</li>
 *   <li>{@code RUNNING → FAILED} when Agent returns 404 (container removed)</li>
 *   <li>{@code RUNNING → CONFIG_DRIFT} when config hash mismatch</li>
 *   <li>No status change when container running and config matches</li>
 *   <li>Poller skips in operator mode</li>
 *   <li>Poller skips when no active deployments exist</li>
 *   <li>Transient HTTP failures retried via RetryingRunnable</li>
 * </ul>
 */
class HostDeploymentStatusPollerTest {

    private HostDeploymentService deploymentService;
    private AnsibleCommandRunner ansibleRunner;
    private HostAgentClient agentClient;
    private HostConfigGroup hostConfig;
    private HostDeploymentStatusPoller poller;

    @BeforeEach
    void setUp() {
        Logger logger = Logger.getLogger(HostDeploymentStatusPollerTest.class);
        deploymentService = mock(HostDeploymentService.class);
        ansibleRunner = mock(AnsibleCommandRunner.class);
        agentClient = mock(HostAgentClient.class);

        hostConfig = mock(HostConfigGroup.class);
        when(hostConfig.containerRuntime()).thenReturn(HostConfigGroup.AGENT_RUNTIME);
        when(hostConfig.configBasePath()).thenReturn("/opt/debezium/configs");
        when(hostConfig.statusPollMaxRetries()).thenReturn(3);

        // Host mode — poller should be active
        poller = new HostDeploymentStatusPoller(logger, deploymentService, ansibleRunner, agentClient, hostConfig, "host");
    }

    @Test
    void transitionsDeployingToRunningWhenContainerRunning() {
        HostDeployment deployment = mockDeployment(1L, DeploymentStatus.DEPLOYING, "container-1", "host-1");

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        when(agentClient.status(eq("host-1"), eq(8090), anyString(), eq("container-1")))
                .thenReturn(new AgentContainerStatus(true, "hash-1"));

        poller.pollDeploymentStatus();

        verify(deploymentService).updateStatus(1L, DeploymentStatus.RUNNING);
    }

    @Test
    void transitionsDeployingToFailedWhenContainerNotRunningAfterGracePeriod() {
        HostDeployment deployment = mockDeployment(2L, DeploymentStatus.DEPLOYING, "container-2", "host-1",
                "default-hash", Instant.now().minus(Duration.ofMinutes(10)));

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        when(agentClient.status(eq("host-1"), eq(8090), anyString(), eq("container-2")))
                .thenReturn(new AgentContainerStatus(false, null));

        poller.pollDeploymentStatus();

        verify(deploymentService).updateStatus(2L, DeploymentStatus.FAILED);
    }

    @Test
    void skipsFailedTransitionWhenWithinGracePeriod() {
        HostDeployment deployment = mockDeployment(8L, DeploymentStatus.DEPLOYING, "container-8", "host-1",
                "default-hash", Instant.now().minus(Duration.ofMinutes(1)));

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        when(agentClient.status(eq("host-1"), eq(8090), anyString(), eq("container-8")))
                .thenReturn(new AgentContainerStatus(false, null));

        poller.pollDeploymentStatus();

        // Should NOT mark FAILED — within 5-minute grace period
        verify(deploymentService, never()).updateStatus(eq(8L), any());
    }

    @Test
    void transitionsRunningToFailedWhenContainerStoppedUnexpectedly() {
        HostDeployment deployment = mockDeployment(3L, DeploymentStatus.RUNNING, "container-3", "host-2");

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        // Agent returns running=false — container genuinely stopped
        when(agentClient.status(eq("host-2"), eq(8090), anyString(), eq("container-3")))
                .thenReturn(new AgentContainerStatus(false, null));

        poller.pollDeploymentStatus();

        // Should mark FAILED immediately — no retry needed
        verify(deploymentService).updateStatus(3L, DeploymentStatus.FAILED);
    }

    @Test
    void transitionsRunningToFailedWhenContainerNotFound() {
        HostDeployment deployment = mockDeployment(11L, DeploymentStatus.RUNNING, "container-11", "host-9");

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        // Agent returns null (404) — container genuinely removed
        when(agentClient.status(eq("host-9"), eq(8090), anyString(), eq("container-11")))
                .thenReturn(null);

        poller.pollDeploymentStatus();

        // Should mark FAILED immediately — 404 is definitive, not retried
        verify(deploymentService).updateStatus(11L, DeploymentStatus.FAILED);
    }

    @Test
    void skipsStatusUpdateWhenAllRetriesExhausted() {
        HostDeployment deployment = mockDeployment(12L, DeploymentStatus.RUNNING, "container-12", "host-10");

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        // Transient HTTP failure — DebeziumException is retried by RetryingRunnable
        when(agentClient.status(eq("host-10"), eq(8090), anyString(), eq("container-12")))
                .thenThrow(new DebeziumException("Connection refused"));

        poller.pollDeploymentStatus();

        // All retries exhausted → DebeziumException caught → no status change
        verify(deploymentService, never()).updateStatus(eq(12L), any());
    }

    @Test
    void retriesTransientFailureBeforeReportingContainerRunning() {
        HostDeployment deployment = mockDeployment(13L, DeploymentStatus.DEPLOYING, "container-13", "host-11");

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        // First call: transient failure. Second call: success.
        when(agentClient.status(eq("host-11"), eq(8090), anyString(), eq("container-13")))
                .thenThrow(new DebeziumException("Connection refused"))
                .thenReturn(new AgentContainerStatus(true, "hash-1"));

        poller.pollDeploymentStatus();

        // RetryingRunnable retried after the first failure, second attempt succeeded
        verify(deploymentService).updateStatus(13L, DeploymentStatus.RUNNING);
    }

    @Test
    void transitionsRunningToConfigDriftWhenHashMismatch() {
        HostDeployment deployment = mockDeployment(4L, DeploymentStatus.RUNNING, "container-4", "host-3",
                "expected-hash-abc", Instant.now().minus(Duration.ofMinutes(10)));

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        // Agent returns running=true but different hash
        when(agentClient.status(eq("host-3"), eq(8090), anyString(), eq("container-4")))
                .thenReturn(new AgentContainerStatus(true, "different-hash-xyz"));

        poller.pollDeploymentStatus();

        verify(deploymentService).updateStatus(4L, DeploymentStatus.CONFIG_DRIFT);
    }

    @Test
    void noStatusChangeWhenContainerRunningAndHashMatches() {
        HostDeployment deployment = mockDeployment(5L, DeploymentStatus.RUNNING, "container-5", "host-4",
                "matching-hash", Instant.now().minus(Duration.ofMinutes(10)));

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        when(agentClient.status(eq("host-4"), eq(8090), anyString(), eq("container-5")))
                .thenReturn(new AgentContainerStatus(true, "matching-hash"));

        poller.pollDeploymentStatus();

        // No status update should happen
        verify(deploymentService, never()).updateStatus(eq(5L), any());
    }

    @Test
    void skipsPollingInOperatorMode() {
        Logger logger = Logger.getLogger(HostDeploymentStatusPollerTest.class);
        HostDeploymentStatusPoller operatorPoller = new HostDeploymentStatusPoller(
                logger, deploymentService, ansibleRunner, agentClient, mock(HostConfigGroup.class), "operator");

        operatorPoller.pollDeploymentStatus();

        // Should not even query for deployments
        verify(deploymentService, never()).findByStatuses(any());
    }

    @Test
    void skipsPollingWhenNoActiveDeployments() {
        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of());

        poller.pollDeploymentStatus();

        // Should not call Agent client
        verify(agentClient, never()).status(anyString(), anyInt(), anyString(), anyString());
    }

    @Test
    void transitionsDeployingToRunningWithAnsibleRuntime() {
        HostDeployment deployment = mockDeployment(14L, DeploymentStatus.DEPLOYING, "container-14", "host-14");
        when(hostConfig.containerRuntime()).thenReturn(HostConfigGroup.ANSIBLE_RUNTIME);
        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        when(ansibleRunner.runShellCommand(eq("host-14"), anyString()))
                .thenReturn(new CommandResult.Success("true"));

        poller.pollDeploymentStatus();

        verify(deploymentService).updateStatus(14L, DeploymentStatus.RUNNING);
        verify(agentClient, never()).status(anyString(), anyInt(), anyString(), anyString());
    }

    @Test
    void detectsConfigDriftWithAnsibleRuntime() {
        HostDeployment deployment = mockDeployment(15L, DeploymentStatus.RUNNING, "container-15", "host-15",
                "expected-hash", Instant.now().minus(Duration.ofMinutes(10)));
        when(hostConfig.containerRuntime()).thenReturn(HostConfigGroup.ANSIBLE_RUNTIME);
        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        when(ansibleRunner.runShellCommand(eq("host-15"), anyString()))
                .thenReturn(new CommandResult.Success("true"))
                .thenReturn(new CommandResult.Success("different-hash"));

        poller.pollDeploymentStatus();

        verify(deploymentService).updateStatus(15L, DeploymentStatus.CONFIG_DRIFT);
        verify(agentClient, never()).status(anyString(), anyInt(), anyString(), anyString());
    }

    @Test
    void handlesExceptionDuringStatusGracefully() {
        HostDeployment deployment = mockDeployment(6L, DeploymentStatus.RUNNING, "container-6", "host-5");

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));

        // Agent throws an unexpected exception (not DebeziumException)
        when(agentClient.status(eq("host-5"), eq(8090), anyString(), eq("container-6")))
                .thenThrow(new RuntimeException("Network error"));

        // Should NOT throw — should log and skip
        poller.pollDeploymentStatus();

        // Should not update status (error is logged, not propagated)
        verify(deploymentService, never()).updateStatus(anyLong(), any());
    }

    @Test
    void skipsConfigDriftWhenHashIsNull() {
        HostDeployment deployment = mockDeployment(7L, DeploymentStatus.RUNNING, "container-7", "host-6",
                "expected-hash", Instant.now().minus(Duration.ofMinutes(10)));

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        // Agent returns running=true but no config hash (file not found)
        when(agentClient.status(eq("host-6"), eq(8090), anyString(), eq("container-7")))
                .thenReturn(new AgentContainerStatus(true, null));

        poller.pollDeploymentStatus();

        // No CONFIG_DRIFT — null hash means file not found, skipped
        verify(deploymentService, never()).updateStatus(eq(7L), any());
    }

    // ── Helper ──

    private HostDeployment mockDeployment(Long id, DeploymentStatus status,
                                          String containerName, String hostname) {
        return mockDeployment(id, status, containerName, hostname,
                "default-hash", Instant.now().minus(Duration.ofMinutes(10)));
    }

    private HostDeployment mockDeployment(Long id, DeploymentStatus status,
                                          String containerName, String hostname,
                                          String configHash, Instant deployedAt) {
        HostDeployment deployment = mock(HostDeployment.class);
        when(deployment.getId()).thenReturn(id);
        when(deployment.getPipelineId()).thenReturn(id);
        when(deployment.getContainerName()).thenReturn(containerName);
        when(deployment.getSshAlias()).thenReturn(hostname);
        when(deployment.getHostname()).thenReturn(hostname);
        when(deployment.getAgentPort()).thenReturn(8090);
        when(deployment.getAgentToken()).thenReturn("test-token");
        when(deployment.getDeploymentStatus()).thenReturn(status);
        when(deployment.getConfigHash()).thenReturn(configHash);
        when(deployment.getDeployedAt()).thenReturn(deployedAt);
        return deployment;
    }
}
