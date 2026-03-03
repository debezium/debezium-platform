/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionValidator;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@Named("PULSAR")
@ApplicationScoped
public class PulsarConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(PulsarConnectionValidator.class);

    private final int defaultConnectionTimeout;

    private static final String SERVICE_HTTP_URL_KEY = "serviceHttpUrl";

    public PulsarConnectionValidator(@ConfigProperty(name = "destinations.pulsar.connection.timeout") int defaultConnectionTimeout) {
        this.defaultConnectionTimeout = defaultConnectionTimeout;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        try {
            LOGGER.debug("Starting Pulsar connection validation for connection: {}", connectionConfig.getName());

            Map<String, Object> pulsarConfig = connectionConfig.getConfig();

            if (!pulsarConfig.containsKey(SERVICE_HTTP_URL_KEY) ||
                    pulsarConfig.get(SERVICE_HTTP_URL_KEY) == null ||
                    pulsarConfig.get(SERVICE_HTTP_URL_KEY).toString().trim().isEmpty()) {
                return ConnectionValidationResult.failed("Service HTTP URL must be specified");
            }

            // Set a reasonable timeout for validation
            pulsarConfig.put("connectionTimeoutMs", defaultConnectionTimeout);

            return performConnectionValidation(pulsarConfig);
        } catch (Exception e) {
            LOGGER.error("Unexpected error during Pulsar connection validation", e);
            return ConnectionValidationResult.failed("Validation failed due to unexpected error: " + e.getMessage());
        }
    }

    private ConnectionValidationResult performConnectionValidation(Map<String, Object> pulsarConfig) {
        LOGGER.debug("Starting Pulsar HTTP connection validation");
        try {
            String serviceHttpUrl = pulsarConfig.get(SERVICE_HTTP_URL_KEY).toString();

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofMillis(defaultConnectionTimeout))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(serviceHttpUrl))
                    .timeout(Duration.ofMillis(defaultConnectionTimeout))
                    .GET()
                    .build();

            HttpResponse<Void> response = client.send(request, HttpResponse.BodyHandlers.discarding());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return ConnectionValidationResult.successful();
            }
            else {
                return ConnectionValidationResult.failed("Pulsar service HTTP endpoint returned status code: " + response.statusCode());
            }
        }
        catch (Exception e) {
            LOGGER.error("Pulsar HTTP connection validation failed", e);
            return ConnectionValidationResult.failed("Pulsar HTTP connection validation failed: " + e.getMessage());
        }
    }
}
