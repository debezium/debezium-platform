/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.discovery;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import io.debezium.platform.domain.views.HostStatus;

/**
 * Pure-function builder that compares SSH config file state against database
 * state and produces a {@link ReconciliationPlan}.
 *
 * <p>This class is intentionally <strong>not</strong> a CDI bean — it has no
 * injected dependencies, no mutable state, and no side effects. Every method
 * is a deterministic transformation of its inputs.
 */
class HostReconciliationPlanBuilder {

    /**
     * Compares SSH config file state against database state and produces
     * a reconciliation plan.
     *
     * @param fileHosts hosts parsed from the SSH config file
     * @param dbHosts   active host views from the database (status ≠ REMOVED)
     * @return the reconciliation plan describing what needs to change
     */
    ReconciliationPlan buildPlan(List<SshHostEntry> fileHosts,
                                 List<HostStatus> dbHosts) {
        Map<String, HostStatus> dbByAlias = dbHosts.stream()
                .collect(Collectors.toMap(HostStatus::getSshAlias, Function.identity()));
        Map<String, SshHostEntry> fileByAlias = fileHosts.stream()
                .collect(Collectors.toMap(SshHostEntry::alias, Function.identity()));

        List<SshHostEntry> toAdd = fileHosts.stream()
                .filter(fileHost -> !dbByAlias.containsKey(fileHost.alias()))
                .toList();

        List<SshHostEntry> toUpdate = fileHosts.stream()
                .filter(fileHost -> dbByAlias.containsKey(fileHost.alias()))
                .filter(fileHost -> isModified(fileHost, dbByAlias.get(fileHost.alias())))
                .toList();

        List<String> toRemove = dbHosts.stream()
                .map(HostStatus::getSshAlias)
                .filter(alias -> !fileByAlias.containsKey(alias))
                .toList();

        return new ReconciliationPlan(toAdd, toRemove, toUpdate);
    }

    /**
     * Per ssh_config(5): if {@code HostName} is absent, the alias is used as hostname.
     */
    String resolveHostname(SshHostEntry entry) {
        return entry.hostname() != null ? entry.hostname() : entry.alias();
    }

    /**
     * Hostname is the critical field — if the IP/address changed, re-provisioning
     * is needed. Per ssh_config(5), absent HostName defaults to the alias.
     */
    private boolean isModified(SshHostEntry fileHost, HostStatus dbHost) {
        String fileHostname = resolveHostname(fileHost);
        String dbHostname = dbHost.getHostname();
        return !fileHostname.equals(dbHostname);
    }
}
