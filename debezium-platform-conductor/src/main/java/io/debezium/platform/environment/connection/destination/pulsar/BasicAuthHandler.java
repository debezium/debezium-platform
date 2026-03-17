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
import org.apache.pulsar.client.impl.auth.AuthenticationBasic;

@Named("BASIC")
@ApplicationScoped
public class BasicAuthHandler implements PulsarAuthHandler {
    @Override
    public void configure(PulsarAdminBuilder builder, Map<String, Object> config) {
        String username = (String) config.get("username");
        String password = (String) config.get("password");

        AuthenticationBasic auth = new AuthenticationBasic();
        String authConfig = String.format(
                "{\"userId\":\"%s\",\"password\":\"%s\"}",
                username, password);
        auth.configure(authConfig);

        builder.authentication(auth);
    }

    @Override
    public void validate(Map<String, Object> config) throws IllegalArgumentException {
        if (isConfigValueMissing(config, "username") || isConfigValueMissing(config, "password")) {
            throw new IllegalArgumentException("invalid or missing credentials for basic auth");
        }
    }
}
