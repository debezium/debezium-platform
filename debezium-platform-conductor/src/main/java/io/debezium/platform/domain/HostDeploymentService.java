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
 *
 * <p><strong>Domain boundary:</strong> All public methods return domain
 * classes ({@link Deployment}, {@link Host}, {@link HostAllocation})
 * instead of JPA entities. This prevents persistence-layer details from
 * leaking into controllers and pollers.
 */
@ApplicationScoped
public class HostDeploymentService {

    private static final Logger logger = Logger.getLogger(HostDeploymentService.class);

    // ── JPQL query constants ──
    private static final String FIND_BY_PIPELINE_JPQL = "SELECT d FROM host_deployment d WHERE d.pipeline.id = :pipelineId";
    private static final String FIND_BY_STATUS_JPQL = "SELECT d FROM host_deployment d WHERE d.deploymentStatus = :status";
    private static final String FIND_BY_STATUSES_JPQL = "SELECT d FROM host_deployment d WHERE d.deploymentStatus IN :statuses";
    private static final String FIND_READY_HOSTS_JPQL = "SELECT h FROM host_status h WHERE h.provisioningStatus = :status ORDER BY h.id ASC";
    private static final String MAX_PORT_JPQL = "SELECT MAX(d.serverPort) FROM host_deployment d WHERE d.hostStatus.id = :hostId";

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
        List<HostStatusEntity> readyEntities = lockAllReadyHosts();

        List<Host> readyHosts = readyEntities.stream()
                .map(Host::from)
                .toList();

        Host selectedHost = deployStrategy.select(readyHosts);

        int allocatedPort = allocatePort(selectedHost.id());

        logger.infov("Selected host {0} (id={1}) with port {2}",
                selectedHost.sshAlias(), selectedHost.id(), allocatedPort);

        return new HostAllocation(selectedHost, allocatedPort);
    }

    /**
     * Creates a new {@link HostDeploymentEntity} linking the pipeline to
     * the selected host. Runs in its own transaction so the deployment
     * record is immediately visible.
     *
     * @param pipelineId   the pipeline being deployed
     * @param hostStatusId the selected host
     * @param request      the deployment details (container name, image, port, config hash)
     */
    @Transactional(REQUIRES_NEW)
    public void createDeployment(Long pipelineId, Long hostStatusId, DeploymentRequest request) {
        HostDeploymentEntity deployment = new HostDeploymentEntity();
        deployment.setPipeline(em.getReference(PipelineEntity.class, pipelineId));
        deployment.setHostStatus(em.getReference(HostStatusEntity.class, hostStatusId));
        deployment.setContainerName(request.containerName());
        deployment.setImageVersion(request.imageVersion());
        deployment.setServerPort(request.serverPort());
        deployment.setDeploymentStatus(DeploymentStatus.DEPLOYING);
        deployment.setConfigHash(request.configHash());
        deployment.setDeployedAt(Instant.now());

        em.persist(deployment);
        logger.infov("Created deployment record for pipeline {0} on host {1}, port {2}",
                pipelineId, hostStatusId, request.serverPort());
    }

    /**
     * Finds the active deployment for a given pipeline.
     */
    @Transactional(REQUIRES_NEW)
    public Optional<Deployment> findByPipelineId(Long pipelineId) {
        return em.createQuery(FIND_BY_PIPELINE_JPQL, HostDeploymentEntity.class)
                .setParameter("pipelineId", pipelineId)
                .getResultStream()
                .findFirst()
                .map(Deployment::from);
    }

    /**
     * Finds the active deployment for a given pipeline, failing loudly if absent.
     */
    @Transactional(REQUIRES_NEW)
    public Deployment requireByPipelineId(Long pipelineId) {
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
    public List<Deployment> findByStatus(DeploymentStatus status) {
        return em.createQuery(FIND_BY_STATUS_JPQL, HostDeploymentEntity.class)
                .setParameter("status", status)
                .getResultStream()
                .map(Deployment::from)
                .toList();
    }

    /**
     * Returns all deployments matching any of the given statuses.
     */
    @Transactional(REQUIRES_NEW)
    public List<Deployment> findByStatuses(DeploymentStatus... statuses) {
        return em.createQuery(FIND_BY_STATUSES_JPQL, HostDeploymentEntity.class)
                .setParameter("statuses", List.of(statuses))
                .getResultStream()
                .map(Deployment::from)
                .toList();
    }

    /**
     * Returns all READY hosts without pessimistic locking.
     */
    @Transactional(REQUIRES_NEW)
    public List<Host> findReadyHosts() {
        return em.createQuery(FIND_READY_HOSTS_JPQL, HostStatusEntity.class)
                .setParameter("status", ProvisioningStatus.READY)
                .getResultStream()
                .map(Host::from)
                .toList();
    }

    /**
     * Locks all READY hosts sorted by ID. Sorting prevents ABBA deadlocks
     * when concurrent transactions lock the same set of rows.
     *
     * <p>Returns JPA entities intentionally — pessimistic locking requires
     * the real managed entity. Domain mapping happens at the public boundary
     * in {@link #allocateHostAndPort()}.
     */
    private List<HostStatusEntity> lockAllReadyHosts() {
        return em.createQuery(FIND_READY_HOSTS_JPQL, HostStatusEntity.class)
                .setParameter("status", ProvisioningStatus.READY)
                .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                .getResultList();
    }

    /**
     * Allocates the next available port on the given host.
     * {@code MAX(serverPort)+1}, starting from base port when empty.
     */
    private int allocatePort(Long hostStatusId) {
        Integer maxPort = em.createQuery(MAX_PORT_JPQL, Integer.class)
                .setParameter("hostId", hostStatusId)
                .getSingleResult();

        return maxPort != null ? maxPort + 1 : hostConfig.basePort();
    }
}
