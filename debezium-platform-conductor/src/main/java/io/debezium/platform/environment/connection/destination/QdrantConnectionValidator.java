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
    private static final String API_KEY = "api.key";
    private static final String HEALTH_ENDPOINT_FORMAT = "http://%s:%d/healthz";

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
        String host = getString(config, HOST);
        if (isBlank(host)) {
            return ConnectionValidationResult.failed("Host must be specified for Qdrant connection");
        }

        Integer port = getInteger(config, PORT);
        if (port == null || port <= 0) {
            port = 6333;
        }

        String apiKey = getString(config, API_KEY);
        String healthEndpoint = HEALTH_ENDPOINT_FORMAT.formatted(host, port);

        return validateHealthEndpoint(healthEndpoint, apiKey);
    }

    private ConnectionValidationResult validateHealthEndpoint(String healthEndpoint, String apiKey) {
        int timeoutInMillis = (int) Duration.ofSeconds(defaultConnectionTimeout).toMillis();

        try {
            URL url = new URL(healthEndpoint);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(timeoutInMillis);
            conn.setReadTimeout(timeoutInMillis);
            if (!isBlank(apiKey)) {
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

    private static String getString(Map<String, Object> config, String key) {
        Object value = config.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private static Integer getInteger(Map<String, Object> config, String key) {
        Object value = config.get(key);
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String strValue) {
            try {
                return Integer.parseInt(strValue);
            }
            catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
