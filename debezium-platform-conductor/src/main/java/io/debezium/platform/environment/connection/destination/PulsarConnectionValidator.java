/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.apache.pulsar.client.admin.PulsarAdmin;
import org.apache.pulsar.client.admin.PulsarAdminBuilder;
import org.apache.pulsar.client.admin.PulsarAdminException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionValidator;
import io.debezium.platform.environment.connection.destination.pulsar.PulsarAuthHandler;
import io.debezium.platform.environment.connection.destination.pulsar.PulsarAuthHandlerFactory;

@Named("APACHE_PULSAR")
@ApplicationScoped
public class PulsarConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(PulsarConnectionValidator.class);

    private final PulsarAuthHandlerFactory authHandlerFactory;

    private final int defaultConnectionTimeout;

    private static final String SERVICE_HTTP_URL_KEY = "serviceHttpUrl";
    private static final String AUTH_SCHEME_KEY = "authScheme";
    public static final String NO_AUTH_SCHEME = "none";

    public PulsarConnectionValidator(@ConfigProperty(name = "destinations.pulsar.connection.timeout") int defaultConnectionTimeout,
                                     PulsarAuthHandlerFactory authHandlerFactory) {
        this.defaultConnectionTimeout = defaultConnectionTimeout;
        this.authHandlerFactory = authHandlerFactory;
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

            String authScheme = pulsarConfig.getOrDefault(AUTH_SCHEME_KEY, NO_AUTH_SCHEME).toString();
            PulsarAuthHandler authHandler = authHandlerFactory.getAuthHandler(authScheme);
            authHandler.validate(pulsarConfig);

            PulsarAdminBuilder builder = PulsarAdmin.builder().serviceHttpUrl(pulsarConfig.get(SERVICE_HTTP_URL_KEY).toString());

            authHandler.configure(builder, pulsarConfig);

            try (PulsarAdmin admin = builder.build()) {
                admin.clusters().getClusters();
                return ConnectionValidationResult.successful();
            }
        }
        catch (IllegalArgumentException e) {
            LOGGER.warn("Invalid Pulsar configuration", e);
            return ConnectionValidationResult.failed("Configuration error: " + e.getMessage());
        }
        catch (PulsarAdminException.TimeoutException e) {
            LOGGER.warn("Timeout during Pulsar connection validation", e);
            return ConnectionValidationResult.failed(
                    "Connection timeout - please check the Pulsar admin URL and network connectivity");
        }
        catch (PulsarAdminException.NotAuthorizedException e) {
            LOGGER.warn("Authorization failed during Pulsar connection validation", e);
            return ConnectionValidationResult.failed(
                    "Authorization failed - please check Pulsar credentials and permissions");
        }
        catch (PulsarAdminException.NotFoundException e) {
            LOGGER.warn("Pulsar admin endpoint or resource not found", e);
            return ConnectionValidationResult.failed(
                    "Pulsar admin endpoint not found - please check the service HTTP URL");
        }
        catch (PulsarAdminException.ConnectException e) {
            LOGGER.warn("Unable to connect to Pulsar admin endpoint", e);
            return ConnectionValidationResult.failed(
                    "Unable to connect - please check the Pulsar admin URL and network connectivity");
        }
        catch (PulsarAdminException e) {
            LOGGER.warn("Pulsar-specific error during validation", e);
            return ConnectionValidationResult.failed(
                    "Pulsar connection error: " + e.getMessage());
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Pulsar connection validation", e);
            return ConnectionValidationResult.failed(
                    "Generic error while connecting to Pulsar");
        }
    }
}
