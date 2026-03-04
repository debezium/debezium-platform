/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.net.HttpURLConnection;
import java.net.URL;
import java.time.Duration;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionConfigUtils;
import io.debezium.platform.environment.connection.ConnectionValidator;

/**
 * Implementation of {@link ConnectionValidator} for Qdrant Sink connections.
 * Validates connectivity to a Qdrant instance via its REST API.
 */
@Named("QDRANT")
@ApplicationScoped
public class QdrantConnectionValidator implements ConnectionValidator {

    private static final String HOST = "host";
    private static final String PORT = "port";
    private static final String PROTOCOL = "protocol";
    private static final String API_KEY = "api.key";

    private final int defaultConnectionTimeout;

    public QdrantConnectionValidator(@ConfigProperty(name = "destinations.qdrant.connection.timeout") int defaultConnectionTimeout) {
        this.defaultConnectionTimeout = defaultConnectionTimeout;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        Map<String, Object> config = connectionConfig.getConfig();
        String host = ConnectionConfigUtils.getString(config, HOST);
        if (ConnectionConfigUtils.isBlank(host)) {
            return ConnectionValidationResult.failed("Host must be specified for Qdrant connection");
        }

        Integer port = ConnectionConfigUtils.getInteger(config, PORT);
        if (port == null || port <= 0) {
            port = 6333;
        }

        String protocol = ConnectionConfigUtils.getString(config, PROTOCOL);
        if (ConnectionConfigUtils.isBlank(protocol)) {
            protocol = "http";
        }

        String apiKey = ConnectionConfigUtils.getString(config, API_KEY);
        String healthEndpoint = protocol + "://" + host + ":" + port + "/healthz";

        try {
            URL url = new URL(healthEndpoint);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout((int) Duration.ofSeconds(defaultConnectionTimeout).toMillis());
            conn.setReadTimeout((int) Duration.ofSeconds(defaultConnectionTimeout).toMillis());
            if (!ConnectionConfigUtils.isBlank(apiKey)) {
                conn.setRequestProperty("api-key", apiKey);
            }
            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                return ConnectionValidationResult.successful();
            }
            return ConnectionValidationResult.failed("Qdrant health check failed with status: " + responseCode);
        }
        catch (Exception e) {
            return ConnectionValidationResult.failed("Qdrant connection error: " + e.getMessage());
        }
    }
}