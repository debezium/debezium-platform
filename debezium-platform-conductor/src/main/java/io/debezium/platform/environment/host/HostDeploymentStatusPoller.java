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

import io.debezium.DebeziumException;
import io.debezium.platform.config.PipelineConfigGroup;
import io.debezium.platform.data.model.DeploymentStatus;
import io.debezium.platform.domain.HostDeploymentService;
import io.debezium.platform.domain.views.HostDeployment;
import io.debezium.platform.environment.host.agent.AgentContainerStatus;
import io.debezium.platform.environment.host.agent.HostAgentClient;
import io.debezium.platform.environment.host.config.HostConfigGroup;
import io.debezium.platform.environment.host.provisioning.AnsibleCommandException;
import io.debezium.platform.environment.host.provisioning.AnsibleCommandRunner;
import io.debezium.platform.environment.host.provisioning.CommandResult;
import io.debezium.util.DelayStrategy;
import io.debezium.util.RetryingRunnable;
import io.quarkus.scheduler.Scheduled;

/**
 * Background poller that checks the runtime state of all deployed containers.
 *
 * <p>Wakes up at a configurable interval (default 30 seconds) and inspects
 * every deployment in {@code DEPLOYING} or {@code RUNNING} state. It uses
 * either the remote Host Agent status endpoint or Ansible ad-hoc commands,
 * according to {@code pipeline.host.container-runtime}.
 *
 * <p><strong>State transitions:</strong>
 * <ul>
 *   <li>{@code DEPLOYING → RUNNING} — container is confirmed running</li>
 *   <li>{@code DEPLOYING → FAILED} — container not running after deploy</li>
 *   <li>{@code RUNNING → FAILED} — container crashed or stopped unexpectedly</li>
 *   <li>{@code RUNNING → CONFIG_DRIFT} — config hash mismatch detected</li>
 * </ul>
 *
 * <p><strong>Retry behaviour:</strong> Both runtime-specific probes use
 * {@link RetryingRunnable}. Agent connectivity failures retry as
 * {@link DebeziumException}; transient Ansible failures retry as
 * {@link AnsibleCommandException}. Definitive stopped or missing-container
 * responses are trusted immediately.
 *
 * <p>Includes a deployment-mode guard to prevent this poller from firing
 * in operator (Kubernetes) mode — {@code @Scheduled} ignores
 * {@code @LookupIfProperty}.
 *
 * @see HostPipelineController
 * @see HostDeploymentService
 *
 * @author Divyanshu Kumar Nayak
 */
@ApplicationScoped
public class HostDeploymentStatusPoller {

    private static final String DOCKER_INSPECT_FORMAT = "docker inspect --format '{%% raw %%}{{.State.Running}}{%% endraw %%}' %s";
    private static final String CONTAINER_RUNNING_VALUE = "true";
    private static final List<String> CONTAINER_NOT_FOUND_MARKERS = List.of(
            "no such object",
            "no such container");
    private static final String CONFIG_PATH_FORMAT = "%s/%s/application.properties";
    private static final String HASH_COMMAND_FORMAT = "sha256sum %s | awk '{print $1}'";

    /**
     * Grace period after a deployment is created before the poller will
     * mark it as FAILED. This allows time for Docker to pull images on
     * servers that don't have the image cached yet.
     */
    private static final Duration DEPLOY_GRACE_PERIOD = Duration.ofMinutes(5);

    private final Logger logger;
    private final HostDeploymentService deploymentService;
    private final AnsibleCommandRunner ansibleRunner;
    private final HostAgentClient agentClient;
    private final HostConfigGroup hostConfig;
    private final PipelineConfigGroup pipelineConfig;
    private final String deploymentMode;

    public HostDeploymentStatusPoller(Logger logger,
                                      HostDeploymentService deploymentService,
                                      AnsibleCommandRunner ansibleRunner,
                                      HostAgentClient agentClient,
                                      HostConfigGroup hostConfig,
                                      PipelineConfigGroup pipelineConfig,
                                      @ConfigProperty(name = PipelineConfigGroup.DEPLOYMENT_MODE_PROPERTY, defaultValue = "operator") String deploymentMode) {
        this.logger = logger;
        this.deploymentService = deploymentService;
        this.ansibleRunner = ansibleRunner;
        this.agentClient = agentClient;
        this.hostConfig = hostConfig;
        this.pipelineConfig = pipelineConfig;
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
        boolean agentRuntime = usesAgentRuntime();
        String host = agentRuntime ? deployment.getHostname() : deployment.getSshAlias();
        String containerName = deployment.getContainerName();
        Long deploymentId = deployment.getId();

        try {
            AgentContainerStatus agentStatus = agentRuntime
                    ? queryStatusWithRetry(deployment.getHostname(), deployment.getAgentPort(),
                            deployment.getAgentToken(), containerName)
                    : null;
            boolean containerRunning = agentRuntime
                    ? agentStatus != null && agentStatus.running()
                    : inspectContainerRunningWithRetry(deployment.getSshAlias(), containerName);

            DeploymentStatus currentStatus = deployment.getDeploymentStatus();

            if (containerRunning && currentStatus == DeploymentStatus.DEPLOYING) {
                deploymentService.updateStatus(deploymentId, DeploymentStatus.RUNNING);
                return;
            }

            if (!containerRunning && currentStatus == DeploymentStatus.DEPLOYING) {
                Instant deployedAt = deployment.getDeployedAt();
                if (deployedAt != null && Duration.between(deployedAt, Instant.now()).compareTo(DEPLOY_GRACE_PERIOD) < 0) {
                    logger.debugv("Container {0} on {1} is not running yet, but still within grace period — skipping",
                            containerName, host);
                    return;
                }
                logger.warnv("Container {0} on {1} is not running after deploy (grace period elapsed), marking FAILED",
                        containerName, host);
                deploymentService.updateStatus(deploymentId, DeploymentStatus.FAILED);
                return;
            }

            if (!containerRunning && currentStatus == DeploymentStatus.RUNNING) {
                logger.warnv("Container {0} on {1} stopped unexpectedly, marking FAILED",
                        containerName, host);
                deploymentService.updateStatus(deploymentId, DeploymentStatus.FAILED);
                return;
            }

            if (containerRunning && currentStatus == DeploymentStatus.RUNNING) {
                if (agentRuntime) {
                    checkAgentConfigDrift(deployment, agentStatus);
                }
                else {
                    checkAnsibleConfigDrift(deployment, deployment.getSshAlias());
                }
            }
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        catch (DebeziumException | AnsibleCommandException e) {
            // All retries exhausted for a transient connectivity failure.
            // The container's actual state is unknown — skip this cycle rather
            // than incorrectly marking FAILED.
            logger.warnv("All status retries exhausted for deployment {0} on {1}, "
                    + "skipping this cycle: {2}", deploymentId, host, e.getMessage());
        }
        catch (Exception e) {
            logger.errorv(e, "Error polling deployment {0} on {1}, skipping this cycle",
                    deploymentId, host);
        }
    }

    /**
     * Wraps {@link HostAgentClient#status} with
     * {@link RetryingRunnable} to tolerate transient HTTP failures.
     *
     * <p>Only {@link DebeziumException} is retried — this means:
     * <ul>
     *   <li>A successful 200 with {@code running=false} (container genuinely
     *       stopped) is trusted immediately — no retry.</li>
     *   <li>A 404 (container not found) is also trusted immediately
     *       (returns {@code null}, not retried).</li>
     *   <li>A transient HTTP connection failure is retried up to N times
     *       with exponential backoff.</li>
     * </ul>
     *
     * @return the container status, or {@code null} if the container doesn't exist
     * @throws DebeziumException if all retries are exhausted
     */
    private AgentContainerStatus queryStatusWithRetry(String hostname, int agentPort,
                                                      String agentToken, String containerName)
            throws DebeziumException, InterruptedException {
        AgentContainerStatus[] result = { null };

        RetryingRunnable.<RuntimeException> builder()
                .retries(hostConfig.statusPollMaxRetries())
                .doRun(() -> result[0] = agentClient.status(hostname, agentPort, agentToken, containerName))
                .delayStrategy(DelayStrategy.exponential(Duration.ofSeconds(1), Duration.ofSeconds(8)))
                .retriableExceptions(DebeziumException.class)
                .build()
                .run();

        return result[0];
    }

    /**
     * Checks for config drift using the hash returned by the Agent's
     * status endpoint, rather than running a separate Ansible command.
     */
    private void checkAgentConfigDrift(HostDeployment deployment, AgentContainerStatus status) {
        String remoteHash = status.configHash();
        String expectedHash = deployment.getConfigHash();

        if (remoteHash == null) {
            logger.debugv("Agent did not return a config hash for deployment {0}, skipping drift check",
                    deployment.getId());
            return;
        }

        if (!remoteHash.equals(expectedHash)) {
            logger.warnv("Config drift detected for deployment {0} on {1}: "
                    + "expected hash={2}, remote hash={3}",
                    deployment.getId(), deployment.getHostname(), expectedHash, remoteHash);
            deploymentService.updateStatus(deployment.getId(), DeploymentStatus.CONFIG_DRIFT);
        }
    }

    private boolean inspectContainerRunningWithRetry(String sshAlias, String containerName)
            throws AnsibleCommandException, InterruptedException {
        boolean[] result = { false };

        RetryingRunnable.<RuntimeException> builder()
                .retries(hostConfig.statusPollMaxRetries())
                .doRun(() -> result[0] = inspectContainerRunning(sshAlias, containerName))
                .delayStrategy(DelayStrategy.exponential(Duration.ofSeconds(1), Duration.ofSeconds(8)))
                .retriableExceptions(AnsibleCommandException.class)
                .build()
                .run();

        return result[0];
    }

    boolean inspectContainerRunning(String sshAlias, String containerName) {
        CommandResult result = ansibleRunner.runShellCommand(sshAlias,
                String.format(DOCKER_INSPECT_FORMAT, containerName));

        return switch (result) {
            case CommandResult.Success success -> extractLastLine(success.output()).equalsIgnoreCase(CONTAINER_RUNNING_VALUE);
            case CommandResult.Failure failure -> {
                if (isContainerNotFound(failure.output())) {
                    yield false;
                }
                throw new AnsibleCommandException("Transient Ansible failure inspecting container "
                        + containerName + " on " + sshAlias + ": " + failure.output());
            }
        };
    }

    private void checkAnsibleConfigDrift(HostDeployment deployment, String sshAlias) {
        String configPath = String.format(CONFIG_PATH_FORMAT,
                hostConfig.configBasePath(), deployment.getContainerName());
        CommandResult result = ansibleRunner.runShellCommand(sshAlias,
                String.format(HASH_COMMAND_FORMAT, configPath));

        if (result instanceof CommandResult.Success success) {
            String remoteHash = extractLastLine(success.output());
            if (!remoteHash.equals(deployment.getConfigHash())) {
                logger.warnv("Config drift detected for deployment {0} on {1}: expected hash={2}, remote hash={3}",
                        deployment.getId(), sshAlias, deployment.getConfigHash(), remoteHash);
                deploymentService.updateStatus(deployment.getId(), DeploymentStatus.CONFIG_DRIFT);
            }
        }
        else {
            logger.debugv("Could not read config hash for deployment {0} on {1}, skipping drift check",
                    deployment.getId(), sshAlias);
        }
    }

    private static boolean isContainerNotFound(String output) {
        if (output == null) {
            return false;
        }
        String lowerOutput = output.toLowerCase();
        return CONTAINER_NOT_FOUND_MARKERS.stream().anyMatch(lowerOutput::contains);
    }

    private static String extractLastLine(String output) {
        if (output == null || output.isBlank()) {
            return "";
        }
        String[] lines = output.trim().split("\\R");
        for (int i = lines.length - 1; i >= 0; i--) {
            String line = lines[i].trim();
            if (!line.isEmpty()) {
                return line;
            }
        }
        return "";
    }

    private boolean usesAgentRuntime() {
        return PipelineConfigGroup.AGENT_RUNTIME.equals(pipelineConfig.host().containerRuntime());
    }

    private boolean isHostMode() {
        return "host".equals(deploymentMode);
    }
}
