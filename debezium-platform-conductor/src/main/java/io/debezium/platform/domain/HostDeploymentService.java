/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static jakarta.transaction.Transactional.TxType.REQUIRES_NEW;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.transaction.Transactional;

import org.jboss.logging.Logger;

import io.debezium.DebeziumException;
import io.debezium.platform.data.model.DeploymentStatus;
import io.debezium.platform.data.model.HostDeploymentEntity;
import io.debezium.platform.data.model.HostStatusEntity;
import io.debezium.platform.data.model.PipelineEntity;
import io.debezium.platform.data.model.ProvisioningStatus;
import io.debezium.platform.environment.host.config.HostConfigGroup;
import io.debezium.platform.environment.host.strategy.DeployStrategy;

/**
 * Concurrency-safe host selection, port allocation, and deployment CRUD.
 *
 * <p><strong>Locking strategy:</strong> All {@code READY} hosts are locked
 * with {@code PESSIMISTIC_WRITE} sorted by ID (deadlock prevention) before
 * any selection or port allocation. The selection method runs in a
 * {@code REQUIRES_NEW} transaction so locks are released before the
 * (potentially slow) Ansible call.
 *
 * <p><strong>Port allocation:</strong> {@code MAX(serverPort)+1} on the
 * selected host, starting from the configurable base port when no
 * deployments exist. Uses a live query (not a stale column) to prevent
 * port collision under concurrent writes.
 */
@ApplicationScoped
public class HostDeploymentService {

    private static final Logger logger = Logger.getLogger(HostDeploymentService.class);

    private final EntityManager em;
    private final DeployStrategy deployStrategy;
    private final HostConfigGroup hostConfig;

    public HostDeploymentService(EntityManager em,
                                 DeployStrategy deployStrategy,
                                 HostConfigGroup hostConfig) {
        this.em = em;
        this.deployStrategy = deployStrategy;
        this.hostConfig = hostConfig;
    }

    /**
     * Result of host selection and port allocation.
     *
     * @param hostStatus    the locked and selected host entity
     * @param allocatedPort the unique port assigned for this deployment
     */
    public record HostAllocation(HostStatusEntity hostStatus, int allocatedPort) {
    }

    /**
     * Atomically selects a host and allocates a port for a new pipeline
     * deployment.
     *
     * <p>Runs in {@code REQUIRES_NEW} so the pessimistic locks are released
     * immediately after selection — before the Ansible call that actually
     * deploys the container. This prevents holding locks for minutes.
     *
     * @return the selected host and its allocated port
     * @throws DebeziumException if no READY hosts are available
     */
    @Transactional(REQUIRES_NEW)
    public HostAllocation allocateHostAndPort() {
        List<HostStatusEntity> readyHosts = lockAllReadyHosts();

        HostStatusEntity selectedHost = deployStrategy.select(readyHosts, this::countDeploymentsForHost);

        int allocatedPort = allocatePort(selectedHost.getId());

        logger.infov("Selected host {0} (id={1}) with port {2}",
                selectedHost.getSshAlias(), selectedHost.getId(), allocatedPort);

        return new HostAllocation(selectedHost, allocatedPort);
    }

    /**
     * Creates a new {@link HostDeploymentEntity} linking the pipeline to
     * the selected host. Runs in its own transaction so the deployment
     * record is immediately visible.
     *
     * @param pipelineId    the pipeline being deployed
     * @param hostStatusId  the selected host
     * @param containerName the Docker container name
     * @param imageVersion  the Debezium Server image version
     * @param serverPort    the allocated port
     * @param configHash    SHA-256 hash of the deployed config
     * @return the persisted deployment entity
     */
    @Transactional(REQUIRES_NEW)
    public HostDeploymentEntity createDeployment(Long pipelineId, Long hostStatusId,
                                                 String containerName, String imageVersion,
                                                 int serverPort, String configHash) {
        HostDeploymentEntity deployment = new HostDeploymentEntity();
        deployment.setPipeline(em.getReference(PipelineEntity.class, pipelineId));
        deployment.setHostStatus(em.getReference(HostStatusEntity.class, hostStatusId));
        deployment.setContainerName(containerName);
        deployment.setImageVersion(imageVersion);
        deployment.setServerPort(serverPort);
        deployment.setDeploymentStatus(DeploymentStatus.DEPLOYING);
        deployment.setConfigHash(configHash);
        deployment.setDeployedAt(Instant.now());

        em.persist(deployment);
        logger.infov("Created deployment record for pipeline {0} on host {1}, port {2}",
                pipelineId, hostStatusId, serverPort);

        return deployment;
    }

    /**
     * Finds the active deployment for a given pipeline.
     */
    @Transactional(REQUIRES_NEW)
    public Optional<HostDeploymentEntity> findByPipelineId(Long pipelineId) {
        return em.createQuery(
                "SELECT d FROM host_deployment d WHERE d.pipeline.id = :pipelineId",
                HostDeploymentEntity.class)
                .setParameter("pipelineId", pipelineId)
                .getResultStream()
                .findFirst();
    }

    /**
     * Finds the active deployment for a given pipeline, failing loudly if absent.
     */
    @Transactional(REQUIRES_NEW)
    public HostDeploymentEntity requireByPipelineId(Long pipelineId) {
        return findByPipelineId(pipelineId)
                .orElseThrow(() -> new DebeziumException(
                        "No active deployment found for pipeline id=" + pipelineId));
    }

    /**
     * Updates the deployment status. Runs in its own transaction.
     */
    @Transactional(REQUIRES_NEW)
    public void updateStatus(Long deploymentId, DeploymentStatus newStatus) {
        HostDeploymentEntity deployment = em.find(HostDeploymentEntity.class, deploymentId);
        if (deployment == null) {
            logger.warnv("Attempted to update status for non-existent deployment id={0}, skipping", deploymentId);
            return;
        }
        DeploymentStatus previousStatus = deployment.getDeploymentStatus();
        deployment.setDeploymentStatus(newStatus);

        // If we are transitioning to DEPLOYING (e.g., from STOPPED during a restart),
        // we must reset the clock so the 5-minute grace period starts from right now.
        if (newStatus == DeploymentStatus.DEPLOYING) {
            deployment.setDeployedAt(Instant.now());
        }

        logger.infov("Deployment {0} status transition: {1} → {2}",
                deploymentId, previousStatus, newStatus);
    }

    /**
     * Hard-deletes the deployment record. Frees the UNIQUE constraint
     * on {@code pipeline_id} and reclaims the port number.
     */
    @Transactional(REQUIRES_NEW)
    public void deleteDeployment(Long deploymentId) {
        HostDeploymentEntity deployment = em.find(HostDeploymentEntity.class, deploymentId);
        if (deployment != null) {
            em.remove(deployment);
            logger.infov("Deleted deployment record id={0}", deploymentId);
        }
    }

    /**
     * Returns all deployments with a given status.
     */
    @Transactional(REQUIRES_NEW)
    public List<HostDeploymentEntity> findByStatus(DeploymentStatus status) {
        return em.createQuery(
                "SELECT d FROM host_deployment d WHERE d.deploymentStatus = :status",
                HostDeploymentEntity.class)
                .setParameter("status", status)
                .getResultList();
    }

    /**
     * Returns all deployments matching any of the given statuses.
     */
    @Transactional(REQUIRES_NEW)
    public List<HostDeploymentEntity> findByStatuses(DeploymentStatus... statuses) {
        return em.createQuery(
                "SELECT d FROM host_deployment d WHERE d.deploymentStatus IN :statuses",
                HostDeploymentEntity.class)
                .setParameter("statuses", List.of(statuses))
                .getResultList();
    }

    /**
     * Returns all READY hosts without pessimistic locking.
     */
    @Transactional(REQUIRES_NEW)
    public List<HostStatusEntity> findReadyHosts() {
        return em.createQuery(
                "SELECT h FROM host_status h WHERE h.provisioningStatus = :status ORDER BY h.id ASC",
                HostStatusEntity.class)
                .setParameter("status", ProvisioningStatus.READY)
                .getResultList();
    }

    /**
     * Locks all READY hosts sorted by ID. Sorting prevents ABBA deadlocks
     * when concurrent transactions lock the same set of rows.
     */
    private List<HostStatusEntity> lockAllReadyHosts() {
        return em.createQuery(
                "SELECT h FROM host_status h WHERE h.provisioningStatus = :status ORDER BY h.id ASC",
                HostStatusEntity.class)
                .setParameter("status", ProvisioningStatus.READY)
                .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                .getResultList();
    }

    /**
     * Live COUNT query for deployments on a given host (not a stale column).
     */
    private long countDeploymentsForHost(Long hostStatusId) {
        return em.createQuery(
                "SELECT COUNT(d) FROM host_deployment d WHERE d.hostStatus.id = :hostId",
                Long.class)
                .setParameter("hostId", hostStatusId)
                .getSingleResult();
    }

    /**
     * Allocates the next available port on the given host.
     * {@code MAX(serverPort)+1}, starting from base port when empty.
     */
    private int allocatePort(Long hostStatusId) {
        Integer maxPort = em.createQuery(
                "SELECT MAX(d.serverPort) FROM host_deployment d WHERE d.hostStatus.id = :hostId",
                Integer.class)
                .setParameter("hostId", hostStatusId)
                .getSingleResult();

        return maxPort != null ? maxPort + 1 : hostConfig.basePort();
    }
}
