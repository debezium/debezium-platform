/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

/**
 * Represents the provisioning lifecycle of a remote host.
 *
 * <ul>
 *   <li>{@code PENDING} — host discovered in SSH config, awaiting Ansible provisioning</li>
 *   <li>{@code PROVISIONING} — Ansible playbook is currently executing</li>
 *   <li>{@code READY} — provisioning completed successfully, host is available for deployments</li>
 *   <li>{@code FAILED} — Ansible provisioning failed (see {@code provisioningReport} for details)</li>
 *   <li>{@code REMOVED} — host was removed from SSH config</li>
 * </ul>
 */
public enum ProvisioningStatus {
    PENDING,
    PROVISIONING,
    READY,
    FAILED,
    REMOVED
}
