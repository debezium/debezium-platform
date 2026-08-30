/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

import org.jboss.logging.Logger;

import io.debezium.platform.data.model.DeploymentStatus;
import io.debezium.platform.data.model.PipelineStatus;
import io.debezium.platform.domain.DeploymentRequest;
import io.debezium.platform.domain.HostAllocation;
import io.debezium.platform.domain.HostDeploymentService;
import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.domain.Signal;
import io.debezium.platform.domain.views.HostDeployment;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.PipelineController;
import io.debezium.platform.environment.host.config.HostConfigGroup;
import io.debezium.platform.environment.logs.LogReader;
import io.debezium.util.Threads;
import io.quarkus.arc.Arc;
import io.quarkus.arc.ManagedContext;
import io.quarkus.runtime.ShutdownEvent;

/**
 * Host-mode implementation of {@link PipelineController}.
 *
 * <p>Orchestrates the full pipeline lifecycle by delegating container
 * operations to {@link HostContainerRuntime}. The current runtime
 * implementation uses Ansible ad-hoc commands; when the Host Agent is
 * built (sub-issue 7+), a new implementation will use REST API calls
 * — no changes needed in this controller.
 *
 * <p>Operations:
 * <ul>
 *   <li>{@code deploy} — maps config, selects host, delegates to runtime</li>
 *   <li>{@code undeploy} — removes container via runtime, deletes DB record</li>
 *   <li>{@code stop} — stops container, marks STOPPED</li>
 *   <li>{@code start} — starts container, marks DEPLOYING</li>
 *   <li>{@code logReader} — retrieves container logs via runtime</li>
 * </ul>
 *
 * <p>Long-running operations are submitted to a dedicated thread pool
 * to avoid blocking the reactive event thread.
 */
@ApplicationScoped
public class HostPipelineController implements PipelineController {

    private final Logger logger;
    private final HostPipelineMapper pipelineMapper;
    private final HostDeploymentService deploymentService;
    private final HostContainerRuntime containerRuntime;
    private final HostConfigGroup hostConfig;
    private final PipelineService pipelineService;
    private final ExecutorService deployExecutor;

    public HostPipelineController(Logger logger,
                                  HostPipelineMapper pipelineMapper,
                                  HostDeploymentService deploymentService,
                                  HostContainerRuntime containerRuntime,
                                  HostConfigGroup hostConfig,
                                  PipelineService pipelineService) {
        this.logger = logger;
        this.pipelineMapper = pipelineMapper;
        this.deploymentService = deploymentService;
        this.containerRuntime = containerRuntime;
        this.hostConfig = hostConfig;
        this.pipelineService = pipelineService;

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
        deployExecutor.submit(() -> runWithRequestContext(() -> executeDeploy(pipeline)));
    }

    @Override
    public void undeploy(Long pipelineId) {
        deployExecutor.submit(() -> runWithRequestContext(() -> executeUndeploy(pipelineId)));
    }

    @Override
    public void undeploySync(Long pipelineId) {
        executeUndeploy(pipelineId);
    }

    @Override
    public void stop(Long pipelineId) {
        deployExecutor.submit(() -> runWithRequestContext(() -> executeStop(pipelineId)));
    }

    @Override
    public void start(Long pipelineId) {
        deployExecutor.submit(() -> runWithRequestContext(() -> executeStart(pipelineId)));
    }

    @Override
    public LogReader logReader(Long pipelineId) {
        return new HostDockerLogReader(pipelineId, deploymentService, containerRuntime);
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
            // ── Cleanup any existing deployment (idempotent redeploy) ──
            deploymentService.findByPipelineId(pipelineId).ifPresent(existing -> {
                logger.infov("Found existing deployment for pipeline {0} (status={1}), cleaning up before redeploy",
                        pipelineId, existing.getDeploymentStatus());
                if (existing.getSshAlias() != null && existing.getContainerName() != null) {
                    containerRuntime.undeploy(existing.getSshAlias(), existing.getContainerName());
                }
                deploymentService.deleteDeployment(existing.getId());
            });

            HostPipelineMapper.MappedConfig mappedConfig = pipelineMapper.map(pipeline);
            HostAllocation allocation = deploymentService.allocateHostAndPort();
            String containerName = pipeline.getName();

            deploymentService.createDeployment(
                    pipelineId, allocation.host().getId(),
                    new DeploymentRequest(containerName, hostConfig.debeziumServerImage(),
                            allocation.allocatedPort(), mappedConfig.configHash()));

            // Delegate all infrastructure work to the container runtime
            containerRuntime.deploy(allocation, containerName,
                    mappedConfig.propertiesContent(), hostConfig.debeziumServerImage());

            logger.infov("Pipeline {0} deployment initiated on host {1}, port {2}, container {3}",
                    pipelineId, allocation.host().getSshAlias(), allocation.allocatedPort(), containerName);
        }
        catch (Exception e) {
            logger.errorv(e, "Unexpected error during deployment of pipeline {0}", pipelineId);
            failDeployment(pipelineId, "Unexpected error: " + e.getMessage());
        }
    }

    private void executeUndeploy(Long pipelineId) {
        logger.infov("Starting undeploy for pipeline {0}", pipelineId);

        HostDeployment deployment = deploymentService.findByPipelineId(pipelineId).orElse(null);

        if (deployment != null) {
            String sshAlias = deployment.getSshAlias();
            String containerName = deployment.getContainerName();

            // Graceful stop (SIGTERM) before force-removing the container.
            try {
                containerRuntime.stop(sshAlias, containerName);
            }
            catch (Exception e) {
                logger.debugv("Container {0} on {1} could not be stopped (may already be stopped): {2}",
                        containerName, sshAlias, e.getMessage());
            }

            containerRuntime.undeploy(sshAlias, containerName);

            // Hard-delete the deployment record (frees UNIQUE constraint + port)
            deploymentService.deleteDeployment(deployment.getId());
            logger.infov("Pipeline {0} undeployed from host {1}", pipelineId, sshAlias);
        }
        else {
            logger.infov("No deployment record found for pipeline {0}, skipping container cleanup", pipelineId);
        }
    }

    private void executeStop(Long pipelineId) {
        logger.infov("Stopping pipeline {0}", pipelineId);

        HostDeployment deployment = deploymentService.requireByPipelineId(pipelineId);
        String sshAlias = deployment.getSshAlias();
        String containerName = deployment.getContainerName();

        containerRuntime.stop(sshAlias, containerName);

        deploymentService.updateStatus(deployment.getId(), DeploymentStatus.STOPPED);
        logger.infov("Pipeline {0} stopped on host {1}", pipelineId, sshAlias);
    }

    private void executeStart(Long pipelineId) {
        logger.infov("Starting pipeline {0}", pipelineId);

        HostDeployment deployment = deploymentService.requireByPipelineId(pipelineId);
        String sshAlias = deployment.getSshAlias();
        String containerName = deployment.getContainerName();

        containerRuntime.start(sshAlias, containerName);

        // Poller will promote DEPLOYING → RUNNING once it detects the container running
        deploymentService.updateStatus(deployment.getId(), DeploymentStatus.DEPLOYING);
        logger.infov("Pipeline {0} start initiated on host {1}", pipelineId, sshAlias);
    }

    private void failDeployment(Long pipelineId, String reason) {
        deploymentService.findByPipelineId(pipelineId)
                .ifPresent(deployment -> deploymentService.updateStatus(deployment.getId(), DeploymentStatus.FAILED));
        pipelineService.updateStatus(pipelineId, PipelineStatus.FAILED, reason);
        logger.errorv("Deployment failed for pipeline {0}: {1}", pipelineId, reason);
    }

    /**
     * Activates a CDI request context for the duration of the given task.
     *
     * <p>The thread pool used by this controller is a plain Java
     * {@link ExecutorService} (created via {@code Threads.newFixedThreadPool}).
     * Plain threads do not carry a CDI request context, which means
     * {@code @RequestScoped} beans (like the JPA {@code EntityManager})
     * are unavailable. This helper manually activates and terminates
     * the context so that {@code @Transactional} service methods work
     * correctly on the pool threads.
     */
    private void runWithRequestContext(Runnable task) {
        var container = Arc.container();
        if (container != null && container.requestContext() != null) {
            ManagedContext requestContext = container.requestContext();
            requestContext.activate();
            try {
                task.run();
            }
            finally {
                requestContext.terminate();
            }
        }
        else {
            task.run();
        }
    }
}
