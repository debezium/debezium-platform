/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

/**
 * Strategy interface for executing host provisioning and deprovisioning.
 *
 * <p>Decouples the lifecycle orchestration ({@link HostProvisioningService})
 * from the actual execution mechanism. The default implementation
 * ({@link AnsibleHostProvisioner}) runs Ansible playbooks via
 * {@link ProcessBuilder}, but alternative implementations (Terraform,
 * Puppet, direct API) can be swapped in without changing the service.
 *
 * @see AnsibleHostProvisioner
 * @see HostProvisioningService
 */
public interface HostProvisioner {

    /**
     * Provisions a remote host, installing all required software
     * and deploying the Host Agent with the given token.
     *
     * @param sshAlias   the SSH config alias identifying the target host
     * @param agentToken the bearer token for Host Agent authentication
     * @return the result of the provisioning operation
     */
    ProvisionResult provision(String sshAlias, String agentToken);

    /**
     * Deprovisions a remote host, removing the Host Agent and
     * cleaning up the installation directory.
     *
     * @param sshAlias the SSH config alias identifying the target host
     * @return the result of the deprovisioning operation
     */
    ProvisionResult deprovision(String sshAlias);

    /**
     * Sealed result type for provisioning operations, replacing
     * boolean/null error-channel ambiguity with explicit
     * success/failure variants.
     */
    sealed interface ProvisionResult {
        record Success(String output) implements ProvisionResult {
        }

        record Failure(String report) implements ProvisionResult {
        }
    }
}
