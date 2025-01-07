/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator;

import jakarta.enterprise.context.Dependent;

import io.debezium.platform.domain.views.Vault;
import io.debezium.platform.environment.VaultController;
import io.fabric8.kubernetes.client.KubernetesClient;

@Dependent
public class OperatorVaultController implements VaultController {

    private final KubernetesClient k8s;

    public OperatorVaultController(KubernetesClient k8s) {
        this.k8s = k8s;
    }

    @Override
    public void deploy(Vault vault) {
    }

    @Override
    public void undeploy(Long id) {

    }
}
