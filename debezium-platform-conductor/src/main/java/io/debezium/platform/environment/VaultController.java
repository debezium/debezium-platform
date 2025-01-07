/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment;

import io.debezium.platform.domain.views.Vault;

public interface VaultController {

    void deploy(Vault vault);

    void undeploy(Long id);
}
