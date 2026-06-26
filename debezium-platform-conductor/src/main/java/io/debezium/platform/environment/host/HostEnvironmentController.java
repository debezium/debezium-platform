/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

import io.debezium.platform.environment.EnvironmentController;
import io.debezium.platform.environment.PipelineController;
import io.debezium.platform.environment.VaultController;
import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * Host-mode implementation of {@link EnvironmentController}.
 * <p>
 * Activated when {@code debezium.deployment.mode=host} is set at runtime.
 * Both this and {@link io.debezium.platform.environment.operator.OperatorEnvironmentController}
 * exist in the CDI container at all times &mdash;
 * {@link io.quarkus.arc.lookup.LookupIfProperty} filters which one is returned
 * by {@link jakarta.enterprise.inject.Instance#get()}.
 * Every new {@code @ApplicationScoped} bean in the {@code environment/host/}
 * package that has any startup behavior ({@code @Observes StartupEvent},
 * {@code @Scheduled}) MUST include a runtime guard at the top of that method:
 * <pre>
 *   if (!"host".equals(deploymentMode)) return;
 * </pre>
 * {@code @LookupIfProperty} has NO effect on {@code @Observes} or
 * {@code @Scheduled} &mdash; only on {@code Instance<T>.get()}.
 * Without the guard, those methods will fire in operator mode and crash
 * (e.g., trying to watch {@code ~/.ssh/config} inside container).
 */
@ApplicationScoped
@LookupIfProperty(name = "debezium.deployment.mode", stringValue = "host")
public class HostEnvironmentController implements EnvironmentController {

    private final Logger logger;
    private final HostVaultController vaultController;

    public HostEnvironmentController(Logger logger, HostVaultController vaultController) {
        this.logger = logger;
        this.vaultController = vaultController;
        logger.info("Host deployment mode activated");
    }

    @Override
    public PipelineController pipelines() {
        // TODO: Replace with HostPipelineController
        throw new UnsupportedOperationException(
                "Host pipeline controller not yet implemented");
    }

    @Override
    public VaultController vaults() {
        return vaultController;
    }
}
