/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.discovery;

import java.time.Instant;
import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import org.jboss.logging.Logger;

import io.debezium.platform.data.model.HostStatusEntity;
import io.debezium.platform.data.model.ProvisioningStatus;

/**
 * Encapsulates all database operations for host reconciliation.
 *
 * <p>This class exists as a separate {@code @ApplicationScoped} bean because
 * {@code @Transactional} annotations are ignored on self-invocations within
 * the same CDI bean. The {@link SshConfigWatcherService} delegates all DB
 * writes to this repository so that each call goes through the CDI proxy
 * and the transaction is properly managed.
 *
 * <p>Uses {@link EntityManager} directly, matching the existing project pattern
 * (see {@code AbstractService}, {@code PipelineService}, etc.).
 */
@ApplicationScoped
public class HostReconciliationRepository {

    private static final int DEFAULT_AGENT_PORT = 8090;

    private final EntityManager entityManager;
    private final Logger logger;

    public HostReconciliationRepository(EntityManager entityManager, Logger logger) {
        this.entityManager = entityManager;
        this.logger = logger;
    }

    /**
     * Returns all host entities whose status is not {@link ProvisioningStatus#REMOVED}.
     */
    @Transactional
    public List<HostStatusEntity> findAllActiveHosts() {
        return entityManager
                .createQuery(
                        "SELECT h FROM host_status h WHERE h.provisioningStatus <> :removedStatus",
                        HostStatusEntity.class)
                .setParameter("removedStatus", ProvisioningStatus.REMOVED)
                .getResultList();
    }

    /**
     * Creates a new {@link HostStatusEntity} with {@link ProvisioningStatus#PENDING}.
     */
    @Transactional
    public void createPendingHost(String alias, String hostname) {
        HostStatusEntity entity = new HostStatusEntity();
        entity.setSshAlias(alias);
        entity.setHostname(hostname);
        entity.setProvisioningStatus(ProvisioningStatus.PENDING);
        entity.setAgentPort(DEFAULT_AGENT_PORT);
        entity.setLastCheckedAt(Instant.now());
        entityManager.persist(entity);
        logger.infov("Created pending host: {0}", alias);
    }

    /**
     * Marks the host with the given alias as {@link ProvisioningStatus#REMOVED}.
     */
    @Transactional
    public void markHostRemoved(String alias) {
        int updated = entityManager
                .createQuery(
                        "UPDATE host_status h SET h.provisioningStatus = :status WHERE h.sshAlias = :alias")
                .setParameter("status", ProvisioningStatus.REMOVED)
                .setParameter("alias", alias)
                .executeUpdate();
        if (updated > 0) {
            logger.infov("Marked host as REMOVED: {0}", alias);
        }
    }

    /**
     * Updates the cached hostname for an existing host and resets its status
     * to {@link ProvisioningStatus#PENDING} so it gets re-provisioned.
     */
    @Transactional
    public void updateHostDetails(String alias, String newHostname) {
        int updated = entityManager
                .createQuery(
                        "UPDATE host_status h SET h.hostname = :hostname, "
                                + "h.provisioningStatus = :status, "
                                + "h.lastCheckedAt = :now "
                                + "WHERE h.sshAlias = :alias")
                .setParameter("hostname", newHostname)
                .setParameter("status", ProvisioningStatus.PENDING)
                .setParameter("now", Instant.now())
                .setParameter("alias", alias)
                .executeUpdate();
        if (updated > 0) {
            logger.infov("Updated host details and reset to PENDING: {0}", alias);
        }
    }
}
