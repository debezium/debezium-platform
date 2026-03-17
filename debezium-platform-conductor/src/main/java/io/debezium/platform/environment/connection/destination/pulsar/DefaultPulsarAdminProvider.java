/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination.pulsar;

import jakarta.enterprise.context.ApplicationScoped;

import org.apache.pulsar.client.admin.PulsarAdmin;
import org.apache.pulsar.client.admin.PulsarAdminBuilder;

@ApplicationScoped
public class DefaultPulsarAdminProvider implements PulsarAdminProvider {
    @Override
    public PulsarAdminBuilder builder() {
        return PulsarAdmin.builder();
    }
}
