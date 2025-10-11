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
import io.debezium.platform.environment.connection.ConnectionValidator;
import io.milvus.v2.client.ConnectConfig;
import io.milvus.v2.client.MilvusClientV2;

/**
 * Implementation of {@link ConnectionValidator} for Milvus vector database connections.
 * <p>
 * This validator performs validation of Milvus connection configurations
 * including network connectivity, authentication, and database accessibility.
 * </p>
 *
 * <p>
 * The validation process includes:
 * <ul>
 *   <li>Connection parameter validation (host, port, database)</li>
 *   <li>Client connection establishment</li>
 *   <li>Authentication verification if credentials are provided</li>
 *   <li>Basic database operation to confirm connectivity</li>
 *   <li>Timeout handling for network issues</li>
 * </ul>
 * </p>
 *
 * @author Pranav Tiwari
 */
@ApplicationScoped
@Named("MILVUS")
public class MilvusConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(MilvusConnectionValidator.class);

    private final int defaultConnectionTimeout;

    private static final String URI_KEY = "uri";
    private static final String DATABASE_KEY = "database";
    private static final String USERNAME_KEY = "username";
    private static final String PASSWORD_KEY = "password";
    private static final String TOKEN_KEY = "token";

    public MilvusConnectionValidator(@ConfigProperty(name = "destinations.milvus.connection.timeout") int defaultConnectionTimeout) {
        this.defaultConnectionTimeout = defaultConnectionTimeout;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        try {
            LOGGER.debug("Starting Milvus connection validation for connection: {}", connectionConfig.getName());

            Map<String, Object> milvusConfig = connectionConfig.getConfig();

            // Validate required configuration parameters
            ConnectionValidationResult configValidation = validateConfiguration(milvusConfig);
            if (!configValidation.valid()) {
                return configValidation;
            }

            return performConnectionValidation(milvusConfig);

        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Milvus connection validation", e);
            return ConnectionValidationResult.failed("Validation failed due to unexpected error: " + e.getMessage());
        }
    }

    /**
     * Validates the required Milvus configuration parameters.
     *
     * @param milvusConfig the Milvus configuration properties
     * @return ConnectionValidationResult indicating parameter validation result
     */
    private ConnectionValidationResult validateConfiguration(Map<String, Object> milvusConfig) {
        if (!milvusConfig.containsKey(URI_KEY) ||
                milvusConfig.get(URI_KEY) == null ||
                milvusConfig.get(URI_KEY).toString().trim().isEmpty()) {
            return ConnectionValidationResult.failed("URI must be specified");
        }

        // Validate URI format
        String uri = milvusConfig.get(URI_KEY).toString().trim();
        if (!uri.startsWith("http://") && !uri.startsWith("https://")) {
            return ConnectionValidationResult.failed("URI must start with http:// or https://");
        }

        return ConnectionValidationResult.successful();
    }

    /**
     * Performs the actual connection validation by attempting to connect to Milvus
     * using the official Milvus V2 SDK client.
     *
     * @param milvusConfig the Milvus configuration properties
     * @return ConnectionValidationResult indicating success or failure
     */
    private ConnectionValidationResult performConnectionValidation(Map<String, Object> milvusConfig) {
        MilvusClientV2 milvusClient = null;

        try {
            LOGGER.debug("Creating Milvus V2 client for validation");

            // Use the provided URI directly
            String uri = milvusConfig.get(URI_KEY).toString().trim();
            LOGGER.debug("Attempting to connect to Milvus at: {}", uri);

            // Build connection configuration using the official API
            var configBuilder = ConnectConfig.builder()
                    .uri(uri)
                    .rpcDeadlineMs(defaultConnectionTimeout * 1000L); // Convert seconds to milliseconds

            // Add database if specified
            if (milvusConfig.containsKey(DATABASE_KEY) && milvusConfig.get(DATABASE_KEY) != null
                    && !milvusConfig.get(DATABASE_KEY).toString().trim().isEmpty()) {
                configBuilder.dbName(milvusConfig.get(DATABASE_KEY).toString());
                LOGGER.debug("Using database: {}", milvusConfig.get(DATABASE_KEY).toString());
            }

            // Add authentication if provided
            if (milvusConfig.containsKey(TOKEN_KEY) && milvusConfig.get(TOKEN_KEY) != null
                    && !milvusConfig.get(TOKEN_KEY).toString().trim().isEmpty()) {
                // Token format: "username:password"
                configBuilder.token(milvusConfig.get(TOKEN_KEY).toString());
                LOGGER.debug("Using token authentication");
            }
            else if (milvusConfig.containsKey(USERNAME_KEY) && milvusConfig.get(USERNAME_KEY) != null
                    && milvusConfig.containsKey(PASSWORD_KEY) && milvusConfig.get(PASSWORD_KEY) != null) {
                // Separate username and password
                configBuilder.username(milvusConfig.get(USERNAME_KEY).toString())
                        .password(milvusConfig.get(PASSWORD_KEY).toString());
                LOGGER.debug("Using username/password authentication for user: {}", milvusConfig.get(USERNAME_KEY).toString());
            }

            // Create client with the configuration
            milvusClient = new MilvusClientV2(configBuilder.build());

            LOGGER.debug("Successfully created Milvus client, performing basic validation");

            // Perform a simple operation to verify the connection works
            // Using listDatabases() as a lightweight operation to test connectivity
            var databases = milvusClient.listDatabases();
            LOGGER.debug("Successfully validated Milvus connection. Available databases: {}", databases.getDatabaseNames().size());

            return ConnectionValidationResult.successful();

        }
        catch (Exception e) {
            LOGGER.warn("Failed to connect to Milvus server", e);

            String errorMessage = e.getMessage();
            if (errorMessage == null) {
                errorMessage = e.getClass().getSimpleName();
            }

            // Handle specific error types with user-friendly messages
            if (errorMessage.contains("timeout") || errorMessage.contains("TimeoutException") ||
                    errorMessage.contains("deadline")) {
                return ConnectionValidationResult.failed(
                        "Connection timeout - please check host, port and network connectivity");
            }
            else if (errorMessage.contains("authentication") || errorMessage.contains("auth") ||
                    errorMessage.contains("permission") || errorMessage.contains("credentials") ||
                    errorMessage.contains("Unauthenticated")) {
                return ConnectionValidationResult.failed(
                        "Authentication failed - please check username, password, or token");
            }
            else if (errorMessage.contains("connect") || errorMessage.contains("refused") ||
                    errorMessage.contains("unreachable") || errorMessage.contains("UNAVAILABLE")) {
                return ConnectionValidationResult.failed(
                        "Cannot connect to Milvus server - please check host and port configuration");
            }
            else if (errorMessage.contains("database") && errorMessage.contains("not found")) {
                return ConnectionValidationResult.failed(
                        "Specified database does not exist - please check database name");
            }
            else {
                return ConnectionValidationResult.failed("Failed to connect to Milvus: " + errorMessage);
            }

        }
        finally {
            if (milvusClient != null) {
                try {
                    LOGGER.debug("Closing Milvus client");
                    milvusClient.close();
                }
                catch (Exception e) {
                    LOGGER.warn("Error closing Milvus client", e);
                }
            }
        }
    }
}
