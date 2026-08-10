/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;

import jakarta.enterprise.context.Dependent;
import jakarta.enterprise.event.Observes;

import org.jboss.logging.Logger;

import io.debezium.DebeziumException;
import io.debezium.platform.data.model.DeploymentStatus;
import io.debezium.platform.data.model.HostDeploymentEntity;
import io.debezium.platform.domain.HostDeploymentService;
import io.debezium.platform.domain.Signal;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.PipelineController;
import io.debezium.platform.environment.host.config.HostConfigGroup;
import io.debezium.platform.environment.host.provisioning.AnsibleCommandRunner;
import io.debezium.platform.environment.host.provisioning.AnsibleCommandRunner.CommandResult;
import io.debezium.platform.environment.logs.LogReader;
import io.debezium.util.Threads;
import io.quarkus.runtime.ShutdownEvent;

/**
 * Host-mode implementation of {@link PipelineController}.
 *
 * <p>Orchestrates the full pipeline lifecycle using Ansible ad-hoc commands
 * as the execution transport. Each operation translates into one or more
 * Ansible commands executed on the remote host via SSH:
 * <ul>
 *   <li>{@code deploy} — copies config, runs {@code docker run}</li>
 *   <li>{@code undeploy} — runs {@code docker rm -f}, deletes DB record</li>
 *   <li>{@code stop} — runs {@code docker stop}</li>
 *   <li>{@code start} — runs {@code docker start}</li>
 *   <li>{@code logReader} — runs {@code docker logs}</li>
 * </ul>
 *
 * <p>Long-running Ansible calls are submitted to a dedicated thread pool
 * to avoid blocking the reactive event thread.
 *
 * <p>When the Host Agent is built (sub-issue 7+), the Ansible calls in
 * this class will be swapped for HTTP REST calls — all other logic
 * (host selection, port allocation, status tracking) stays unchanged.
 */
@Dependent
public class HostPipelineController implements PipelineController {

    private static final String DOCKER_RUN_FORMAT = "docker run -d --name %s -p %d:8080 -v %s:/debezium/conf/application.properties %s";
    private static final String DOCKER_RM_FORMAT = "docker rm -f %s";
    private static final String DOCKER_STOP_FORMAT = "docker stop %s";
    private static final String DOCKER_START_FORMAT = "docker start %s";
    private static final String DOCKER_LOGS_FORMAT = "docker logs --tail 500 %s";
    private static final String CONFIG_FILE_NAME = "application.properties";
    private static final String PATH_SEPARATOR = "/";

    private final Logger logger;
    private final HostPipelineMapper pipelineMapper;
    private final HostDeploymentService deploymentService;
    private final AnsibleCommandRunner ansibleRunner;
    private final HostConfigGroup hostConfig;
    private final ExecutorService deployExecutor;

    public HostPipelineController(Logger logger,
                                  HostPipelineMapper pipelineMapper,
                                  HostDeploymentService deploymentService,
                                  AnsibleCommandRunner ansibleRunner,
                                  HostConfigGroup hostConfig) {
        this.logger = logger;
        this.pipelineMapper = pipelineMapper;
        this.deploymentService = deploymentService;
        this.ansibleRunner = ansibleRunner;
        this.hostConfig = hostConfig;

        this.deployExecutor = Threads.newFixedThreadPool(
                HostPipelineController.class, "conductor", "pipeline-deployer",
                hostConfig.executorPoolSize());
    }

    void onStop(@Observes ShutdownEvent ev) {
        deployExecutor.shutdown();
        try {
            if (!deployExecutor.awaitTermination(hostConfig.shutdownTimeoutSeconds(), TimeUnit.SECONDS)) {
                deployExecutor.shutdownNow();
            }
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public void deploy(PipelineFlat pipeline) {
        deployExecutor.submit(() -> executeDeploy(pipeline));
    }

    @Override
    public void undeploy(Long pipelineId) {
        deployExecutor.submit(() -> executeUndeploy(pipelineId));
    }

    @Override
    public void stop(Long pipelineId) {
        deployExecutor.submit(() -> executeStop(pipelineId));
    }

    @Override
    public void start(Long pipelineId) {
        deployExecutor.submit(() -> executeStart(pipelineId));
    }

    @Override
    public LogReader logReader(Long pipelineId) {
        return new AnsibleDockerLogReader(pipelineId);
    }

    /**
     * Signals are not supported in host mode. The in-process signal channel
     * requires co-location with the Debezium Server process, which only
     * exists in K8s operator mode.
     */
    @Override
    public void sendSignal(Long pipelineId, Signal signal) {
        throw new UnsupportedOperationException(
                "Signals are not supported in host deployment mode. "
                        + "The in-process signal channel requires the operator (Kubernetes) environment.");
    }

    private void executeDeploy(PipelineFlat pipeline) {
        Long pipelineId = pipeline.getId();
        logger.infov("Starting deployment for pipeline {0} ({1})", pipelineId, pipeline.getName());

        try {
            HostPipelineMapper.MappedConfig mappedConfig = pipelineMapper.map(pipeline);

            HostDeploymentService.HostAllocation allocation = deploymentService.allocateHostAndPort();
            String sshAlias = allocation.hostStatus().getSshAlias();
            int port = allocation.allocatedPort();

            String containerName = hostConfig.containerNamePrefix() + pipelineId;
            String configDir = hostConfig.configBasePath() + PATH_SEPARATOR + pipelineId;
            String configPath = configDir + PATH_SEPARATOR + CONFIG_FILE_NAME;

            deploymentService.createDeployment(
                    pipelineId, allocation.hostStatus().getId(),
                    containerName, hostConfig.debeziumServerImage(),
                    port, mappedConfig.configHash());

            CommandResult mkdirResult = ansibleRunner.createDirectory(sshAlias, configDir);
            if (mkdirResult instanceof CommandResult.Failure failure) {
                logger.errorv("Failed to create config directory on {0}: {1}", sshAlias, failure.output());
                failDeployment(pipelineId, "Failed to create config directory: " + failure.output());
                return;
            }

            CommandResult copyResult = ansibleRunner.copyContent(sshAlias, mappedConfig.propertiesContent(), configPath);
            if (copyResult instanceof CommandResult.Failure failure) {
                logger.errorv("Failed to copy config to {0}: {1}", sshAlias, failure.output());
                failDeployment(pipelineId, "Failed to copy config: " + failure.output());
                return;
            }

            String dockerCommand = String.format(DOCKER_RUN_FORMAT,
                    containerName, port, configPath, hostConfig.debeziumServerImage());
            CommandResult runResult = ansibleRunner.runShellCommand(sshAlias, dockerCommand);

            if (runResult instanceof CommandResult.Failure failure) {
                logger.errorv("Failed to start container on {0}: {1}", sshAlias, failure.output());
                failDeployment(pipelineId, "Docker run failed: " + failure.output());
                return;
            }

            logger.infov("Pipeline {0} deployment initiated on host {1}, port {2}, container {3}",
                    pipelineId, sshAlias, port, containerName);
        }
        catch (Exception e) {
            logger.errorv(e, "Unexpected error during deployment of pipeline {0}", pipelineId);
            failDeployment(pipelineId, "Unexpected error: " + e.getMessage());
        }
    }

    private void executeUndeploy(Long pipelineId) {
        logger.infov("Starting undeploy for pipeline {0}", pipelineId);

        HostDeploymentEntity deployment = deploymentService.findByPipelineId(pipelineId).orElse(null);
        if (deployment == null) {
            logger.warnv("No active deployment found for pipeline {0}, skipping undeploy", pipelineId);
            return;
        }

        String sshAlias = deployment.getHostStatus().getSshAlias();
        String containerName = deployment.getContainerName();

        // Force-remove the container
        String dockerCommand = String.format(DOCKER_RM_FORMAT, containerName);
        CommandResult result = ansibleRunner.runShellCommand(sshAlias, dockerCommand);

        if (result instanceof CommandResult.Failure failure) {
            logger.warnv("docker rm -f failed for {0} on {1}: {2} — proceeding with DB cleanup",
                    containerName, sshAlias, failure.output());
        }

        // Hard-delete the deployment record (frees UNIQUE constraint + port)
        deploymentService.deleteDeployment(deployment.getId());
        logger.infov("Pipeline {0} undeployed from host {1}", pipelineId, sshAlias);
    }

    private void executeStop(Long pipelineId) {
        logger.infov("Stopping pipeline {0}", pipelineId);

        HostDeploymentEntity deployment = deploymentService.requireByPipelineId(pipelineId);
        String sshAlias = deployment.getHostStatus().getSshAlias();
        String containerName = deployment.getContainerName();

        String dockerCommand = String.format(DOCKER_STOP_FORMAT, containerName);
        CommandResult result = ansibleRunner.runShellCommand(sshAlias, dockerCommand);

        if (result instanceof CommandResult.Failure failure) {
            logger.errorv("docker stop failed for {0} on {1}: {2}",
                    containerName, sshAlias, failure.output());
            throw new DebeziumException("Failed to stop container " + containerName + ": " + failure.output());
        }

        deploymentService.updateStatus(deployment.getId(), DeploymentStatus.STOPPED);
        logger.infov("Pipeline {0} stopped on host {1}", pipelineId, sshAlias);
    }

    private void executeStart(Long pipelineId) {
        logger.infov("Starting pipeline {0}", pipelineId);

        HostDeploymentEntity deployment = deploymentService.requireByPipelineId(pipelineId);
        String sshAlias = deployment.getHostStatus().getSshAlias();
        String containerName = deployment.getContainerName();

        String dockerCommand = String.format(DOCKER_START_FORMAT, containerName);
        CommandResult result = ansibleRunner.runShellCommand(sshAlias, dockerCommand);

        if (result instanceof CommandResult.Failure failure) {
            logger.errorv("docker start failed for {0} on {1}: {2}",
                    containerName, sshAlias, failure.output());
            throw new DebeziumException("Failed to start container " + containerName + ": " + failure.output());
        }

        // Poller will promote DEPLOYING → RUNNING once it detects the container running
        deploymentService.updateStatus(deployment.getId(), DeploymentStatus.DEPLOYING);
        logger.infov("Pipeline {0} start initiated on host {1}", pipelineId, sshAlias);
    }

    private void failDeployment(Long pipelineId, String reason) {
        deploymentService.findByPipelineId(pipelineId)
                .ifPresent(deployment -> deploymentService.updateStatus(deployment.getId(), DeploymentStatus.FAILED));
        logger.errorv("Deployment failed for pipeline {0}: {1}", pipelineId, reason);
    }

    /**
     * {@link LogReader} implementation that reads Docker container logs
     * via Ansible ad-hoc commands.
     */
    private class AnsibleDockerLogReader implements LogReader {

        private final Long pipelineId;
        private BufferedReader reader;

        AnsibleDockerLogReader(Long pipelineId) {
            this.pipelineId = pipelineId;
        }

        @Override
        public String readAll() {
            HostDeploymentEntity deployment = deploymentService.requireByPipelineId(pipelineId);
            String sshAlias = deployment.getHostStatus().getSshAlias();
            String containerName = deployment.getContainerName();

            String dockerCommand = String.format(DOCKER_LOGS_FORMAT, containerName);
            CommandResult result = ansibleRunner.runShellCommand(sshAlias, dockerCommand);

            return switch (result) {
                case CommandResult.Success success -> success.output();
                case CommandResult.Failure failure -> "[Log retrieval failed: " + failure.output() + "]";
            };
        }

        @Override
        public BufferedReader reader() throws IOException {
            if (reader == null) {
                String content = readAll();
                reader = new BufferedReader(
                        new InputStreamReader(
                                new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)),
                                StandardCharsets.UTF_8));
            }
            return reader;
        }

        @Override
        public String readLine() throws IOException {
            return reader().readLine();
        }

        @Override
        public void close() throws IOException {
            if (reader != null) {
                reader.close();
            }
        }
    }
}
