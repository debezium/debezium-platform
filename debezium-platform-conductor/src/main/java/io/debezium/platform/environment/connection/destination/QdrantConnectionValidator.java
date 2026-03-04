/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

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

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        Map<String, Object> config = connectionConfig.getConfig();
        String host = (String) config.getOrDefault("host", "localhost");
        Integer port = (Integer) config.getOrDefault("port", 6333);
        String protocol = (String) config.getOrDefault("protocol", "http");
        String healthEndpoint = protocol + "://" + host + ":" + port + "/healthz";

        try {
            URL url = new URL(healthEndpoint);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
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
