/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import io.debezium.platform.data.model.DeploymentStatus;
import io.debezium.platform.domain.HostDeploymentService;
import io.debezium.platform.domain.views.HostDeployment;
import io.debezium.platform.environment.host.config.HostConfigGroup;
import io.debezium.platform.environment.host.provisioning.AnsibleCommandRunner;
import io.debezium.platform.environment.host.provisioning.CommandResult;
import io.quarkus.scheduler.Scheduled;

/**
 * Background poller that checks the runtime state of all deployed containers.
 *
 * <p>Wakes up at a configurable interval (default 30 seconds) and inspects
 * every deployment in {@code DEPLOYING} or {@code RUNNING} state. Uses
 * Ansible ad-hoc commands to run {@code docker inspect} on the remote host.
 *
 * <p><strong>State transitions:</strong>
 * <ul>
 *   <li>{@code DEPLOYING → RUNNING} — container is confirmed running</li>
 *   <li>{@code DEPLOYING → FAILED} — container not running after deploy</li>
 *   <li>{@code RUNNING → FAILED} — container crashed or stopped unexpectedly</li>
 *   <li>{@code RUNNING → CONFIG_DRIFT} — config hash mismatch detected</li>
 * </ul>
 *
 * <p>Includes a deployment-mode guard to prevent this poller from firing
 * in operator (Kubernetes) mode — {@code @Scheduled} ignores
 * {@code @LookupIfProperty}.
 *
 * @see HostPipelineController
 * @see HostDeploymentService
 */
@ApplicationScoped
public class HostDeploymentStatusPoller {

    private static final String DOCKER_INSPECT_FORMAT = "docker inspect --format '{%% raw %%}{{.State.Running}}{%% endraw %%}' %s";
    private static final String CONTAINER_RUNNING_VALUE = "true";

    /**
     * Grace period after a deployment is created before the poller will
     * mark it as FAILED. This allows time for Docker to pull images on
     * servers that don't have the image cached yet.
     */
    private static final Duration DEPLOY_GRACE_PERIOD = Duration.ofMinutes(5);

    /** Remote path format for the deployed config file (matches HostPipelineController). */
    private static final String CONFIG_PATH_FORMAT = "%s/%s/application.properties";
    private static final String HASH_COMMAND_FORMAT = "sha256sum %s | awk '{print $1}'";

    private final Logger logger;
    private final HostDeploymentService deploymentService;
    private final AnsibleCommandRunner ansibleRunner;
    private final HostConfigGroup hostConfig;
    private final String deploymentMode;

    public HostDeploymentStatusPoller(Logger logger,
                                      HostDeploymentService deploymentService,
                                      AnsibleCommandRunner ansibleRunner,
                                      HostConfigGroup hostConfig,
                                      @ConfigProperty(name = "platform.deployment.mode", defaultValue = "operator") String deploymentMode) {
        this.logger = logger;
        this.deploymentService = deploymentService;
        this.ansibleRunner = ansibleRunner;
        this.hostConfig = hostConfig;
        this.deploymentMode = deploymentMode;
    }

    /**
     * Scheduled poll that checks container state and config integrity.
     * The interval is configured via {@code platform.host.status-poll-interval}.
     */
    @Scheduled(every = "${platform.host.status-poll-interval:30s}", identity = "host-deployment-status-poller")
    void pollDeploymentStatus() {
        if (!isHostMode()) {
            return;
        }

        List<HostDeployment> activeDeployments = deploymentService.findByStatuses(
                DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING);

        if (activeDeployments.isEmpty()) {
            logger.debugv("No active deployments to poll");
            return;
        }

        logger.debugv("Polling {0} active deployment(s)", activeDeployments.size());
        activeDeployments.forEach(this::checkDeployment);
    }

    private void checkDeployment(HostDeployment deployment) {
        String sshAlias = deployment.getSshAlias();
        String containerName = deployment.getContainerName();
        Long deploymentId = deployment.getId();

        try {
            boolean containerRunning = inspectContainerRunning(sshAlias, containerName);

            DeploymentStatus currentStatus = deployment.getDeploymentStatus();

            if (containerRunning && currentStatus == DeploymentStatus.DEPLOYING) {
                deploymentService.updateStatus(deploymentId, DeploymentStatus.RUNNING);
                return;
            }

            if (!containerRunning && currentStatus == DeploymentStatus.DEPLOYING) {
                Instant deployedAt = deployment.getDeployedAt();
                if (deployedAt != null && Duration.between(deployedAt, Instant.now()).compareTo(DEPLOY_GRACE_PERIOD) < 0) {
                    logger.debugv("Container {0} on {1} is not running yet, but still within grace period — skipping",
                            containerName, sshAlias);
                    return;
                }
                logger.warnv("Container {0} on {1} is not running after deploy (grace period elapsed), marking FAILED",
                        containerName, sshAlias);
                deploymentService.updateStatus(deploymentId, DeploymentStatus.FAILED);
                return;
            }

            if (!containerRunning && currentStatus == DeploymentStatus.RUNNING) {
                logger.warnv("Container {0} on {1} stopped unexpectedly, marking FAILED",
                        containerName, sshAlias);
                deploymentService.updateStatus(deploymentId, DeploymentStatus.FAILED);
                return;
            }

            // Container is running and status is RUNNING — check for config drift
            if (containerRunning && currentStatus == DeploymentStatus.RUNNING) {
                checkConfigDrift(deployment, sshAlias);
            }
        }
        catch (Exception e) {
            logger.errorv(e, "Error polling deployment {0} on {1}, skipping this cycle",
                    deploymentId, sshAlias);
        }
    }

    private boolean inspectContainerRunning(String sshAlias, String containerName) {
        String inspectCommand = String.format(DOCKER_INSPECT_FORMAT, containerName);
        CommandResult result = ansibleRunner.runShellCommand(sshAlias, inspectCommand);

        return switch (result) {
            case CommandResult.Success success -> extractLastLine(success.output()).equalsIgnoreCase(CONTAINER_RUNNING_VALUE);
            case CommandResult.Failure ignored -> false;
        };
    }

    private void checkConfigDrift(HostDeployment deployment, String sshAlias) {
        String configPath = String.format(CONFIG_PATH_FORMAT,
                hostConfig.configBasePath(), deployment.getContainerName());
        String hashCommand = String.format(HASH_COMMAND_FORMAT, configPath);

        CommandResult result = ansibleRunner.runShellCommand(sshAlias, hashCommand);

        if (result instanceof CommandResult.Success success) {
            String remoteHash = extractLastLine(success.output());
            String expectedHash = deployment.getConfigHash();

            if (!remoteHash.equals(expectedHash)) {
                logger.warnv("Config drift detected for deployment {0} on {1}: "
                        + "expected hash={2}, remote hash={3}",
                        deployment.getId(), sshAlias, expectedHash, remoteHash);
                deploymentService.updateStatus(deployment.getId(), DeploymentStatus.CONFIG_DRIFT);
            }
        }
        else {
            logger.debugv("Could not read config hash for deployment {0} on {1}, skipping drift check",
                    deployment.getId(), sshAlias);
        }
    }

    /**
     * Extracts the last non-blank line from Ansible ad-hoc output.
     *
     * <p>Ansible ad-hoc commands wrap the remote command's stdout in metadata:
     * <pre>
     * [WARNING]: Host 'test-host' is using the discovered Python interpreter...
     * test-host | CHANGED | rc=0 >>
     * e1272390382212e4164631eaa80eb72ced68c390887220163f90211cca1c3129
     * </pre>
     * The actual command output (in this case the sha256 hash) is always on
     * the last non-blank line. This method strips all the noise and returns
     * only that value.
     */
    private static String extractLastLine(String output) {
        if (output == null || output.isBlank()) {
            return "";
        }
        String[] lines = output.trim().split("\\R");
        // Walk backwards to find the first non-blank line
        for (int i = lines.length - 1; i >= 0; i--) {
            String line = lines[i].trim();
            if (!line.isEmpty()) {
                return line;
            }
        }
        return "";
    }

    private boolean isHostMode() {
        return "host".equals(deploymentMode);
    }
}
