/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

/**
 * Executes Ansible playbooks to provision and deprovision remote hosts.
 *
 * <p>STUB — this class body is intentionally minimal pending Sub-Issue 5.
 * The method signatures are final and will not change. Only the bodies
 * will be filled in by Sub-Issue 5.
 *
 * @see io.debezium.platform.environment.host.discovery.SshConfigWatcherService
 */
@ApplicationScoped
public class HostProvisioningService {

    private final Logger logger;

    public HostProvisioningService(Logger logger) {
        this.logger = logger;
    }

    /**
     * Triggers Ansible provisioning for the given SSH host alias.
     *
     * <p>Sets {@code HostStatusEntity} status: PENDING → PROVISIONING → READY or FAILED.
     *
     * @param sshAlias the SSH config alias identifying the target host
     */
    public void provision(String sshAlias) {
        // TODO: Implemented in Sub-Issue 5 — executes Ansible playbook for this host
        logger.infov("Provisioning host (stub — Sub-Issue 5 pending): {0}", sshAlias);
    }

    /**
     * Triggers Ansible deprovisioning (agent removal and cleanup) for the given host.
     *
     * @param sshAlias the SSH config alias identifying the target host
     */
    public void deprovision(String sshAlias) {
        // TODO: Implemented in Sub-Issue 5 — undeploys agent and cleans up host
        logger.infov("Deprovisioning host (stub — Sub-Issue 5 pending): {0}", sshAlias);
    }
}
