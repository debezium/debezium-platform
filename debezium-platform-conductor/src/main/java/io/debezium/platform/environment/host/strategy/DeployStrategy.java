/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.strategy;

import java.util.List;

import io.debezium.platform.domain.views.refs.HostStatusReference;

/**
 * Strategy for selecting a target host during pipeline deployment.
 *
 * <p>Implementations receive the list of {@code READY} hosts (already
 * locked with {@code PESSIMISTIC_WRITE} and projected as Blaze-Persistence
 * views) and return the selected host, or throw if no host is available.
 *
 * <p>The interface operates on {@link HostStatusReference} views instead
 * of JPA entities so that strategy implementations have no dependency on
 * the persistence layer.
 *
 * <p>The default implementation is {@link RoundRobinStrategy}.
 * Future alternatives (affinity-based, resource-based, labeled scheduling)
 * can be swapped in without changing the deployment service.
 */
public interface DeployStrategy {

    /**
     * Selects a host from the given list of ready hosts.
     *
     * @param readyHosts  all hosts with {@code READY} status, sorted by ID
     * @return the selected host
     * @throws io.debezium.DebeziumException if no hosts are available
     */
    HostStatusReference select(List<HostStatusReference> readyHosts);
}
