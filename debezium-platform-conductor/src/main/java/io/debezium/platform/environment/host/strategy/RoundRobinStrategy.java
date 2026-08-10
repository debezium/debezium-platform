/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.strategy;

import java.util.Comparator;
import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;

import io.debezium.DebeziumException;
import io.debezium.platform.data.model.HostStatusEntity;

/**
 * Least-loaded round-robin host selection strategy.
 *
 * <p>Selects the {@code READY} host with the fewest active deployments.
 * When multiple hosts have the same load, the host with the lowest ID
 * is chosen (deterministic tie-breaking).
 *
 * <p>Fails loudly if no ready hosts are available — never silently
 * returns a default or null, per Mario's "Fail Loud, Never Guess" rule.
 */
@ApplicationScoped
public class RoundRobinStrategy implements DeployStrategy {

    @Override
    public HostStatusEntity select(List<HostStatusEntity> readyHosts, LoadCounter loadCounter) {
        if (readyHosts.isEmpty()) {
            throw new DebeziumException(
                    "No READY hosts available for pipeline deployment. "
                            + "Provision at least one host via SSH config before deploying pipelines.");
        }

        return readyHosts.stream()
                .min(Comparator.comparingLong((HostStatusEntity host) -> loadCounter.countDeployments(host.getId()))
                        .thenComparingLong(HostStatusEntity::getId))
                .orElseThrow(() -> new DebeziumException("No READY hosts available for pipeline deployment."));
    }
}
