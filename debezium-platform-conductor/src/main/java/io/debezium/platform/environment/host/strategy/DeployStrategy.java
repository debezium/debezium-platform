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
 * locked with {@code PESSIMISTIC_WRITE}) and return the selected
 * host, or throw if no host is available.
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
     * @return the selected host entity
     * @throws io.debezium.DebeziumException if no hosts are available
     */
    HostStatusEntity select(List<HostStatusEntity> readyHosts);
}
