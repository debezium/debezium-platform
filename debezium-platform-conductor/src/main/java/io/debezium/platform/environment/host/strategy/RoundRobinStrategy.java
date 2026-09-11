/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.strategy;

import java.util.Comparator;
import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;

import io.debezium.DebeziumException;
import io.debezium.platform.domain.views.refs.HostStatusReference;

/**
 * Least-loaded round-robin host selection strategy.
 *
 * <p>Selects the {@code READY} host with the fewest active deployments.
 * When multiple hosts have the same load, the host with the lowest ID
 * is chosen (deterministic tie-breaking).
 *
 * <p>Deployment counts are queried live from the database to ensure
 * accuracy under concurrent writes. The {@link EntityManager} is
 * injected directly to avoid a circular dependency with
 * {@code HostDeploymentService} (which depends on {@code DeployStrategy}).
 *
 * @author Divyanshu Kumar Nayak
 */
@ApplicationScoped
public class RoundRobinStrategy implements DeployStrategy {

    private static final String COUNT_DEPLOYMENTS_JPQL = "SELECT COUNT(d) FROM host_deployment d WHERE d.hostStatus.id = :hostId";

    private final EntityManager em;

    public RoundRobinStrategy(EntityManager em) {
        this.em = em;
    }

    @Override
    public HostStatusReference select(List<HostStatusReference> readyHosts) {
        if (readyHosts.isEmpty()) {
            throw new DebeziumException(
                    "No READY hosts available for pipeline deployment. "
                            + "Provision at least one host via SSH config before deploying pipelines.");
        }

        return readyHosts.stream()
                .min(Comparator.comparingLong((HostStatusReference host) -> countDeployments(host.getId()))
                        .thenComparingLong(HostStatusReference::getId))
                .orElseThrow(() -> new DebeziumException("No READY hosts available for pipeline deployment."));
    }

    /**
     * Live COUNT query for deployments on a given host.
     * Kept internal to this strategy — other strategies may not need load counts.
     */
    private long countDeployments(Long hostStatusId) {
        return em.createQuery(COUNT_DEPLOYMENTS_JPQL, Long.class)
                .setParameter("hostId", hostStatusId)
                .getSingleResult();
    }
}
