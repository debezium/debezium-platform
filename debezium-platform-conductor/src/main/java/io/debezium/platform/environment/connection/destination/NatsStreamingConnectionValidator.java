/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.time.Duration;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionValidator;
import io.debezium.util.Strings;
import io.nats.client.Nats;
import io.nats.client.Options;

/**
 * Validates connectivity to a NATS Streaming server.
 */
@Named("NATS_STREAMING")
@ApplicationScoped
public class NatsStreamingConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(NatsStreamingConnectionValidator.class);

    private static final String URL = "url";
    private static final String USERNAME = "username";
    private static final String PASSWORD = "password";
    private static final String CLUSTER_ID = "cluster.id";
    private static final String CLIENT_ID = "client.id";

    private final int defaultConnectionTimeoutSeconds;

    public NatsStreamingConnectionValidator(
                                            @ConfigProperty(name = "destinations.nats.connection.timeout", defaultValue = "60") int defaultConnectionTimeoutSeconds) {
        this.defaultConnectionTimeoutSeconds = defaultConnectionTimeoutSeconds;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        Map<String, Object> config = connectionConfig.getConfig();
        String url = (String) config.get(URL);
        String username = (String) config.get(USERNAME);
        String password = (String) config.get(PASSWORD);
        String clusterId = (String) config.get(CLUSTER_ID);
        String clientId = (String) config.get(CLIENT_ID);

        if (Strings.isNullOrBlank(url)) {
            return ConnectionValidationResult.failed("URL must be specified");
        }
        if (Strings.isNullOrBlank(clusterId)) {
            return ConnectionValidationResult.failed("Cluster ID must be specified");
        }
        if (Strings.isNullOrBlank(clientId)) {
            return ConnectionValidationResult.failed("Client ID must be specified");
        }

        Options.Builder natsOptionsBuilder = new Options.Builder()
                .server(url)
                .connectionTimeout(Duration.ofSeconds(defaultConnectionTimeoutSeconds))
                .noReconnect();
        if (!Strings.isNullOrBlank(username)) {
            natsOptionsBuilder.userInfo(username, password != null ? password : "");
        }

        try (io.nats.client.Connection nc = Nats.connect(natsOptionsBuilder.build())) {
            LOGGER.debug("Successfully validated NATS connection at {}", url);
            return ConnectionValidationResult.successful();
        }
        catch (Exception e) {
            LOGGER.warn("Unable to connect to NATS Streaming at {}", url, e);
            return ConnectionValidationResult.failed("Failed to connect to NATS Streaming: " + e.getMessage());
        }
    }
}