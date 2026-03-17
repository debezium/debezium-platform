/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination.pulsar;

import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.apache.pulsar.client.admin.PulsarAdminBuilder;

@Named("NONE")
@ApplicationScoped
public class NoAuthHandler implements PulsarAuthHandler {
    @Override
    public void configure(PulsarAdminBuilder builder, Map<String, Object> config) {
        // Nothing to configure
    }

    @Override
    public void validate(Map<String, Object> config) throws IllegalArgumentException {
        // Nothing to validate
    }
}
