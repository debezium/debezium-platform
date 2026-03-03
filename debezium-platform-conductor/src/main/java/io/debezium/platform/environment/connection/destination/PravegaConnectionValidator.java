/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.net.URI;
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
import io.pravega.client.ClientConfig;
import io.pravega.client.admin.StreamManager;

/**
 * Implementation of {@link ConnectionValidator} for Pravega connections.
 * <p>
 * This validator performs validation of Pravega connection configurations
 * including controller URI reachability and scope existence.
 * </p>
 *
 * <p>
 * The validation process includes:
 * <ul>
 *   <li>Controller URI format verification</li>
 *   <li>Pravega controller connectivity verification</li>
 *   <li>Scope existence check to confirm successful connection</li>
 * </ul>
 * </p>
 *
 * @author Yuang Li
 */
@Named("PRAVEGA")
@ApplicationScoped
public class PravegaConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(PravegaConnectionValidator.class);

    private static final String CONTROLLER_URI_KEY = "controller.uri";
    private static final String SCOPE_KEY = "scope";

    private final int defaultConnectionTimeoutSeconds;

    public PravegaConnectionValidator(@ConfigProperty(name = "destinations.pravega.connection.timeout", defaultValue = "60") int defaultConnectionTimeoutSeconds) {
        this.defaultConnectionTimeoutSeconds = defaultConnectionTimeoutSeconds;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        try {
            LOGGER.debug("Starting Pravega connection validation for connection: {}", connectionConfig.getName());

            Map<String, Object> config = connectionConfig.getConfig();

            if (!config.containsKey(CONTROLLER_URI_KEY) ||
                    config.get(CONTROLLER_URI_KEY) == null ||
                    config.get(CONTROLLER_URI_KEY).toString().trim().isEmpty()) {
                return ConnectionValidationResult.failed("Controller URI must be specified");
            }

            if (!config.containsKey(SCOPE_KEY) ||
                    config.get(SCOPE_KEY) == null ||
                    config.get(SCOPE_KEY).toString().trim().isEmpty()) {
                return ConnectionValidationResult.failed("Scope must be specified");
            }

            String controllerUri = config.get(CONTROLLER_URI_KEY).toString().trim();
            String scope = config.get(SCOPE_KEY).toString().trim();

            return performConnectionValidation(controllerUri, scope);
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Pravega connection validation", e);
            return ConnectionValidationResult.failed("Validation failed due to unexpected error: " + e.getMessage());
        }
    }

    /**
     * Performs the actual connection validation by attempting to connect to the
     * Pravega controller and verify scope existence.
     *
     * @param controllerUri the Pravega controller URI
     * @param scope the Pravega scope to verify
     * @return ConnectionValidationResult indicating success or failure
     */
    private ConnectionValidationResult performConnectionValidation(String controllerUri, String scope) {
        StreamManager streamManager = null;
        try {
            LOGGER.debug("Creating Pravega StreamManager for validation");

            URI uri = URI.create(controllerUri);

            ClientConfig clientConfig = ClientConfig.builder()
                    .controllerURI(uri)
                    .connectTimeoutMilliSec((int) Duration.ofSeconds(defaultConnectionTimeoutSeconds).toMillis())
                    .build();

            streamManager = StreamManager.create(clientConfig);

            LOGGER.debug("Attempting to check scope '{}' existence", scope);
            boolean scopeExists = streamManager.checkScopeExists(scope);

            LOGGER.debug("Successfully connected to Pravega controller. Scope '{}' exists: {}", scope, scopeExists);
            return ConnectionValidationResult.successful();
        }
        catch (IllegalArgumentException e) {
            LOGGER.warn("Invalid Pravega controller URI", e);
            return ConnectionValidationResult.failed("Invalid controller URI: " + e.getMessage());
        }
        catch (Exception e) {
            LOGGER.warn("Failed to connect to Pravega controller at {}", controllerUri, e);
            return ConnectionValidationResult.failed("Failed to connect to Pravega controller: " + e.getMessage());
        }
        finally {
            if (streamManager != null) {
                try {
                    LOGGER.debug("Closing Pravega StreamManager");
                    streamManager.close();
                }
                catch (Exception e) {
                    LOGGER.warn("Error closing Pravega StreamManager", e);
                }
            }
        }
    }
}
