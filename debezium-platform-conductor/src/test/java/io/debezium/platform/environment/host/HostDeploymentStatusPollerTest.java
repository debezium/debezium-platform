/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import static org.mockito.ArgumentMatchers.any;
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

import io.debezium.platform.data.model.DeploymentStatus;
import io.debezium.platform.domain.HostDeploymentService;
import io.debezium.platform.domain.views.HostDeployment;
import io.debezium.platform.environment.host.config.HostConfigGroup;
import io.debezium.platform.environment.host.provisioning.AnsibleCommandRunner;
import io.debezium.platform.environment.host.provisioning.CommandResult;

/**
 * Unit tests for {@link HostDeploymentStatusPoller}.
 *
 * <p>Verifies all state transition scenarios:
 * <ul>
 *   <li>{@code DEPLOYING → RUNNING} when container is confirmed running</li>
 *   <li>{@code DEPLOYING → FAILED} when container is not running after deploy</li>
 *   <li>{@code RUNNING → FAILED} when container stopped unexpectedly</li>
 *   <li>{@code RUNNING → CONFIG_DRIFT} when config hash mismatch detected</li>
 *   <li>No status change when container is running and config hash matches</li>
 *   <li>Poller skips in operator mode (deployment-mode guard)</li>
 *   <li>Poller skips when no active deployments exist</li>
 * </ul>
 */
class HostDeploymentStatusPollerTest {

    private HostDeploymentService deploymentService;
    private AnsibleCommandRunner ansibleRunner;
    private HostDeploymentStatusPoller poller;

    @BeforeEach
    void setUp() {
        Logger logger = Logger.getLogger(HostDeploymentStatusPollerTest.class);
        deploymentService = mock(HostDeploymentService.class);
        ansibleRunner = mock(AnsibleCommandRunner.class);

        HostConfigGroup hostConfig = mock(HostConfigGroup.class);
        when(hostConfig.configBasePath()).thenReturn("/opt/debezium/configs");

        // Host mode — poller should be active
        poller = new HostDeploymentStatusPoller(logger, deploymentService, ansibleRunner, hostConfig, "host");
    }

    @Test
    void transitionsDeployingToRunningWhenContainerRunning() {
        HostDeployment deployment = mockDeployment(1L, DeploymentStatus.DEPLOYING, "container-1", "host-1");

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        when(ansibleRunner.runShellCommand(eq("host-1"), any()))
                .thenReturn(new CommandResult.Success("true"));

        poller.pollDeploymentStatus();

        verify(deploymentService).updateStatus(1L, DeploymentStatus.RUNNING);
    }

    @Test
    void transitionsDeployingToFailedWhenContainerNotRunningAfterGracePeriod() {
        HostDeployment deployment = mockDeployment(2L, DeploymentStatus.DEPLOYING, "container-2", "host-1",
                "default-hash", Instant.now().minus(Duration.ofMinutes(10)));

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        when(ansibleRunner.runShellCommand(eq("host-1"), any()))
                .thenReturn(new CommandResult.Success("false"));

        poller.pollDeploymentStatus();

        verify(deploymentService).updateStatus(2L, DeploymentStatus.FAILED);
    }

    @Test
    void skipsFailedTransitionWhenWithinGracePeriod() {
        HostDeployment deployment = mockDeployment(8L, DeploymentStatus.DEPLOYING, "container-8", "host-1",
                "default-hash", Instant.now().minus(Duration.ofMinutes(1)));

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        when(ansibleRunner.runShellCommand(eq("host-1"), any()))
                .thenReturn(new CommandResult.Success("false"));

        poller.pollDeploymentStatus();

        // Should NOT mark FAILED — within 5-minute grace period
        verify(deploymentService, never()).updateStatus(eq(8L), any());
    }

    @Test
    void transitionsRunningToFailedWhenContainerStoppedUnexpectedly() {
        HostDeployment deployment = mockDeployment(3L, DeploymentStatus.RUNNING, "container-3", "host-2");

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));
        when(ansibleRunner.runShellCommand(eq("host-2"), any()))
                .thenReturn(new CommandResult.Failure("No such container"));

        poller.pollDeploymentStatus();

        verify(deploymentService).updateStatus(3L, DeploymentStatus.FAILED);
    }

    @Test
    void transitionsRunningToConfigDriftWhenHashMismatch() {
        HostDeployment deployment = mockDeployment(4L, DeploymentStatus.RUNNING, "container-4", "host-3",
                "expected-hash-abc", Instant.now().minus(Duration.ofMinutes(10)));

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));

        // First call: docker inspect → running
        // Second call: sha256sum → different hash
        when(ansibleRunner.runShellCommand(eq("host-3"), any()))
                .thenReturn(new CommandResult.Success("true"))
                .thenReturn(new CommandResult.Success("different-hash-xyz"));

        poller.pollDeploymentStatus();

        verify(deploymentService).updateStatus(4L, DeploymentStatus.CONFIG_DRIFT);
    }

    @Test
    void noStatusChangeWhenContainerRunningAndHashMatches() {
        HostDeployment deployment = mockDeployment(5L, DeploymentStatus.RUNNING, "container-5", "host-4",
                "matching-hash", Instant.now().minus(Duration.ofMinutes(10)));

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));

        // First call: docker inspect → running
        // Second call: sha256sum → matching hash
        when(ansibleRunner.runShellCommand(eq("host-4"), any()))
                .thenReturn(new CommandResult.Success("true"))
                .thenReturn(new CommandResult.Success("matching-hash"));

        poller.pollDeploymentStatus();

        // No status update should happen
        verify(deploymentService, never()).updateStatus(eq(5L), any());
    }

    @Test
    void skipsPollingInOperatorMode() {
        Logger logger = Logger.getLogger(HostDeploymentStatusPollerTest.class);
        HostDeploymentStatusPoller operatorPoller = new HostDeploymentStatusPoller(
                logger, deploymentService, ansibleRunner, mock(HostConfigGroup.class), "operator");

        operatorPoller.pollDeploymentStatus();

        // Should not even query for deployments
        verify(deploymentService, never()).findByStatuses(any());
    }

    @Test
    void skipsPollingWhenNoActiveDeployments() {
        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of());

        poller.pollDeploymentStatus();

        // Should not call Ansible
        verify(ansibleRunner, never()).runShellCommand(anyString(), anyString());
    }

    @Test
    void handlesExceptionDuringInspectGracefully() {
        HostDeployment deployment = mockDeployment(6L, DeploymentStatus.RUNNING, "container-6", "host-5");

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));

        // Ansible throws an unexpected exception
        when(ansibleRunner.runShellCommand(eq("host-5"), any()))
                .thenThrow(new RuntimeException("Network error"));

        // Should NOT throw — should log and skip
        poller.pollDeploymentStatus();

        // Should not update status (error is logged, not propagated)
        verify(deploymentService, never()).updateStatus(anyLong(), any());
    }

    @Test
    void skipsConfigDriftWhenHashCommandFails() {
        HostDeployment deployment = mockDeployment(7L, DeploymentStatus.RUNNING, "container-7", "host-6",
                "expected-hash", Instant.now().minus(Duration.ofMinutes(10)));

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));

        // First call: docker inspect → running
        // Second call: sha256sum → Failure (e.g., file not found)
        when(ansibleRunner.runShellCommand(eq("host-6"), any()))
                .thenReturn(new CommandResult.Success("true"))
                .thenReturn(new CommandResult.Failure("No such file or directory"));

        poller.pollDeploymentStatus();

        // No status update — sha256sum failure is silently skipped (only logged at debug)
        verify(deploymentService, never()).updateStatus(eq(7L), any());
    }

    @Test
    void handlesNoisyAnsibleOutputForConfigHash() {
        // Reproduces the exact output Ansible returns on test-host:
        // Warnings + metadata + the actual hash on the last line
        HostDeployment deployment = mockDeployment(9L, DeploymentStatus.RUNNING, "container-9", "host-7",
                "e1272390382212e4164631eaa80eb72ced68c390887220163f90211cca1c3129",
                Instant.now().minus(Duration.ofMinutes(10)));

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));

        String noisyOutput = "[WARNING]: Host 'test-host' is using the discovered Python interpreter "
                + "at '/usr/bin/python3.14', but future installation of another Python interpreter "
                + "could cause a different interpreter to be discovered.\n"
                + "test-host | CHANGED | rc=0 >>\n"
                + "e1272390382212e4164631eaa80eb72ced68c390887220163f90211cca1c3129\n";

        // First call: docker inspect → running
        // Second call: sha256sum → noisy but hash matches
        when(ansibleRunner.runShellCommand(eq("host-7"), any()))
                .thenReturn(new CommandResult.Success("true"))
                .thenReturn(new CommandResult.Success(noisyOutput));

        poller.pollDeploymentStatus();

        // Should NOT mark CONFIG_DRIFT — hash is the same after extracting the last line
        verify(deploymentService, never()).updateStatus(eq(9L), eq(DeploymentStatus.CONFIG_DRIFT));
    }

    @Test
    void handlesNoisyAnsibleOutputForDockerInspect() {
        // Verifies docker inspect also works when Ansible wraps output with warnings
        HostDeployment deployment = mockDeployment(10L, DeploymentStatus.DEPLOYING, "container-10", "host-8");

        when(deploymentService.findByStatuses(DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING))
                .thenReturn(List.of(deployment));

        String noisyInspect = "[WARNING]: Host 'test-host' is using the discovered Python interpreter.\n"
                + "test-host | CHANGED | rc=0 >>\n"
                + "true\n";

        when(ansibleRunner.runShellCommand(eq("host-8"), any()))
                .thenReturn(new CommandResult.Success(noisyInspect));

        poller.pollDeploymentStatus();

        // Should transition DEPLOYING → RUNNING even with noisy output
        verify(deploymentService).updateStatus(10L, DeploymentStatus.RUNNING);
    }

    // ── Helper ──

    private HostDeployment mockDeployment(Long id, DeploymentStatus status,
                                          String containerName, String sshAlias) {
        return mockDeployment(id, status, containerName, sshAlias,
                "default-hash", Instant.now().minus(Duration.ofMinutes(10)));
    }

    private HostDeployment mockDeployment(Long id, DeploymentStatus status,
                                          String containerName, String sshAlias,
                                          String configHash, Instant deployedAt) {
        HostDeployment deployment = mock(HostDeployment.class);
        when(deployment.getId()).thenReturn(id);
        when(deployment.getPipelineId()).thenReturn(id);
        when(deployment.getContainerName()).thenReturn(containerName);
        when(deployment.getSshAlias()).thenReturn(sshAlias);
        when(deployment.getDeploymentStatus()).thenReturn(status);
        when(deployment.getConfigHash()).thenReturn(configHash);
        when(deployment.getDeployedAt()).thenReturn(deployedAt);
        return deployment;
    }
}
