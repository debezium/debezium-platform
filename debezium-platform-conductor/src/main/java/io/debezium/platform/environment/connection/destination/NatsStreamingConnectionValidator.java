/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionConfigUtils;
import io.debezium.platform.environment.connection.ConnectionValidator;

import io.nats.client.ConnectionFactory;
import io.nats.client.NATS;
import io.nats.client.Options;

/**
 * Validates connectivity to a NATS Streaming server.
 */
@Named("NATS_STREAMING")
@ApplicationScoped
public class NatsStreamingConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(NatsStreamingConnectionValidator.class);

    private static final String HOST = "host";
    private static final String PORT = "port";
    private static final String USERNAME = "username";
    private static final String PASSWORD = "password";
    private static final String CLUSTER_ID = "cluster.id";
    private static final String CLIENT_ID = "client.id";

    private final int defaultConnectionTimeoutSeconds;

    public NatsStreamingConnectionValidator(@ConfigProperty(name = "destinations.nats.connection.timeout", defaultValue = "60") int defaultConnectionTimeoutSeconds) {
        this.defaultConnectionTimeoutSeconds = defaultConnectionTimeoutSeconds;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        Map<String, Object> config = connectionConfig.getConfig();
        String host = ConnectionConfigUtils.getString(config, HOST);
        Integer port = ConnectionConfigUtils.getInteger(config, PORT);
        String username = ConnectionConfigUtils.getString(config, USERNAME);
        String password = ConnectionConfigUtils.getString(config, PASSWORD);
        String clusterId = ConnectionConfigUtils.getString(config, CLUSTER_ID);
        String clientId = ConnectionConfigUtils.getString(config, CLIENT_ID);

        if (ConnectionConfigUtils.isBlank(host) || port == null || port <= 0) {
            return ConnectionValidationResult.failed("Host and port must be specified");
        }
        if (ConnectionConfigUtils.isBlank(clusterId) || ConnectionConfigUtils.isBlank(clientId)) {
            return ConnectionValidationResult.failed("Cluster ID and Client ID must be specified");
        }

        String url = String.format("nats://%s:%d", host, port);
        Options.Builder builder = new Options.Builder().server(url).connectionTimeout(defaultConnectionTimeoutSeconds * 1000);
        if (!ConnectionConfigUtils.isBlank(username)) {
            builder.userInfo(username, password != null ? password : "");
        }

        try (io.nats.client.Connection natsConnection = NATS.connect(builder.build())) {
            // If connection is successful, return success
            return ConnectionValidationResult.successful();
        }
        catch (Exception e) {
            LOGGER.warn("Unable to connect to NATS Streaming at {}:{}", host, port, e);
            return ConnectionValidationResult.failed("Failed to connect to NATS Streaming: " + e.getMessage());
        }
    }
}
