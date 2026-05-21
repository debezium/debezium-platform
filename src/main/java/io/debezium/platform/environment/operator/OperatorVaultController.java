package io.debezium.platform.environment.operator;

import io.debezium.platform.domain.views.Vault;
import io.debezium.platform.environment.VaultController;
import io.fabric8.kubernetes.client.KubernetesClient;
import jakarta.enterprise.context.Dependent;


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
