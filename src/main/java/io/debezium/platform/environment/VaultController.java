package io.debezium.platform.environment;

import io.debezium.platform.domain.views.Vault;

public interface VaultController {

    void deploy(Vault vault);

    void undeploy(Long id);
}
