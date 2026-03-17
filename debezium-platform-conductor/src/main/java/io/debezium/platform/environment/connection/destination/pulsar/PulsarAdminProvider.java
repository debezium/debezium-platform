/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination.pulsar;

import org.apache.pulsar.client.admin.PulsarAdminBuilder;

/**
 * Provides configured {@link PulsarAdminBuilder} instances for Pulsar administrative operations.
 * <p>
 * This abstraction centralizes the creation of {@link PulsarAdminBuilder} objects so that
 * callers can start from a common builder setup and then apply connection-specific details
 * such as the service URL and authentication options.
 * </p>
 *
 * <p>
 * It is primarily used during Pulsar connection validation and other operations that require
 * constructing a {@code PulsarAdmin} client.
 * </p>
 *
 * @author Mario Fiore Vitale
 */
public interface PulsarAdminProvider {

    /**
     * Creates or returns a {@link PulsarAdminBuilder} ready for further customization.
     *
     * @return a Pulsar admin builder instance
     */
    PulsarAdminBuilder builder();
}
