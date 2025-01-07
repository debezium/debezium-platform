/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.watcher.consumers;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import jakarta.enterprise.context.Dependent;

import org.jboss.logging.Logger;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.debezium.platform.domain.views.Vault;
import io.debezium.platform.environment.EnvironmentController;
import io.debezium.platform.environment.watcher.events.EventType;

@Dependent
public class VaultConsumer extends AbstractEventConsumer<Vault> {

    public VaultConsumer(Logger logger, EnvironmentController environment, ObjectMapper objectMapper) {
        super(logger, environment, objectMapper, Vault.class);
    }

    @Override
    public Collection<String> consumedAggregates() {
        return List.of("vault");
    }

    @Override
    public Collection<String> consumedTypes() {
        return List.of(EventType.UPDATE.name(), EventType.DELETE.name());
    }

    @Override
    public Class<Vault> consumedPayloadType() {
        return Vault.class;
    }

    @Override
    public void accept(Long id, Optional<Vault> payload) {
        logger.info("Received vault event: " + id);
        logger.info(">>> payload:  \n" + payload);
        var vaults = environment.vaults();

        payload.ifPresentOrElse(vaults::deploy, () -> vaults.undeploy(id));
    }
}
