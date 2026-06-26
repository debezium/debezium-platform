/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import jakarta.enterprise.context.Dependent;

import io.debezium.platform.domain.views.Vault;
import io.debezium.platform.environment.VaultController;

@Dependent
public class HostVaultController implements VaultController {

    @Override
    public void deploy(Vault vault) {
        // No-op: host mode does not use the Kubernetes operator vault integration
    }

    @Override
    public void undeploy(Long id) {
        // No-op: host mode does not use the Kubernetes operator vault integration
    }
}
