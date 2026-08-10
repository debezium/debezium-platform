/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.strategy;

import java.util.List;

import io.debezium.platform.data.model.HostStatusEntity;

/**
 * Strategy for selecting a target host during pipeline deployment.
 *
 * <p>Implementations receive the list of {@code READY} hosts (already
 * locked with {@code PESSIMISTIC_WRITE}) and a function to query the
 * live deployment count for each host. The strategy returns the selected
 * host, or empty if no host is available.
 *
 * <p>The default implementation is {@link RoundRobinStrategy}.
 * Future alternatives (affinity-based, resource-based, labeled scheduling)
 * can be swapped in without changing the deployment service.
 */
public interface DeployStrategy {

    /**
     * Selects a host from the given list of locked, ready hosts.
     *
     * @param readyHosts  all hosts with {@code READY} status, sorted by ID,
     *                    locked with {@code PESSIMISTIC_WRITE}
     * @param loadCounter function that returns the number of active
     *                    deployments for a given host ID
     * @return the selected host entity
     * @throws io.debezium.DebeziumException if no hosts are available
     */
    HostStatusEntity select(List<HostStatusEntity> readyHosts, LoadCounter loadCounter);

    /**
     * Functional interface for querying the live deployment count per host.
     */
    @FunctionalInterface
    interface LoadCounter {
        long countDeployments(Long hostStatusId);
    }
}
