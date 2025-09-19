/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.common.util.concurrent.ListenableFuture;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionValidator;
import io.qdrant.client.QdrantClient;
import io.qdrant.client.QdrantGrpcClient;

/**
 * Implementation of {@link ConnectionValidator} for Qdrant vector database connections.
 * <p>
 * This validator performs validation of Qdrant connection configurations
 * including network connectivity and server accessibility.
 * </p>
 *
 * <p>
 * The validation process includes:
 * <ul>
 *   <li>Connection parameter validation (hostname, port)</li>
 *   <li>Network connectivity verification</li>
 *   <li>Server health check by listing collections</li>
 *   <li>Timeout handling for network issues</li>
 * </ul>
 * </p>
 *
 * @author Pranav Tiwari
 */
@ApplicationScoped
@Named("QDRANT")
public class QdrantConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(QdrantConnectionValidator.class);

    private final int defaultConnectionTimeout;

    private static final String HOSTNAME_KEY = "hostname";
    private static final String PORT_KEY = "port";
    private static final String USE_TLS_KEY = "useTls";
    private static final String API_KEY_KEY = "apiKey";
    private static final int DEFAULT_PORT = 6334;

    public QdrantConnectionValidator(@ConfigProperty(name = "destinations.qdrant.connection.timeout") int defaultConnectionTimeout) {
        this.defaultConnectionTimeout = defaultConnectionTimeout;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        try {
            LOGGER.info("Starting Qdrant connection validation for connection: {}", connectionConfig.getName());

            Map<String, Object> qdrantConfig = connectionConfig.getConfig();

            ConnectionValidationResult paramValidation = validateConnectionParameters(qdrantConfig);
            if (!paramValidation.valid()) {
                return ConnectionValidationResult.failed(paramValidation.message());
            }

            String hostname = qdrantConfig.get(HOSTNAME_KEY).toString();
            int port = getPortValue(qdrantConfig);
            boolean useTls = getBooleanValue(qdrantConfig, USE_TLS_KEY, false);
            String apiKey = getStringValue(qdrantConfig, API_KEY_KEY);

            return performConnectionValidation(hostname, port, useTls, apiKey);

        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Qdrant connection validation", e);
            return ConnectionValidationResult.failed("Validation failed due to unexpected error: " + e.getMessage());
        }
    }

    /**
     * Validates the connection parameters for required fields and correct types.
     *
     * @param config the Qdrant configuration properties
     * @return ConnectionValidationResult indicating if parameters are valid
     */
    private ConnectionValidationResult validateConnectionParameters(Map<String, Object> config) {
        if (!config.containsKey(HOSTNAME_KEY) ||
                config.get(HOSTNAME_KEY) == null ||
                config.get(HOSTNAME_KEY).toString().trim().isEmpty()) {
            return ConnectionValidationResult.failed("Hostname must be specified");
        }

        if (!config.containsKey(PORT_KEY) ||
                config.get(PORT_KEY) == null) {
            return ConnectionValidationResult.failed("Port must be specified");
        }

        try {
            int port = getPortValue(config);
            if (port <= 0 || port > 65535) {
                return ConnectionValidationResult.failed("Port must be between 1 and 65535");
            }
        }
        catch (NumberFormatException e) {
            return ConnectionValidationResult.failed("Port must be a valid integer");
        }

        return ConnectionValidationResult.successful();
    }

    /**
     * Performs the actual connection validation by attempting to connect to Qdrant
     * and list collections.
     *
     * @param hostname the Qdrant server hostname
     * @param port the Qdrant server port
     * @param useTls whether to use TLS connection
     * @param apiKey optional API key for authentication
     * @return ConnectionConnectionValidationResult indicating success or failure
     */
    private ConnectionValidationResult performConnectionValidation(String hostname, int port, boolean useTls, String apiKey) {
        QdrantClient client = null;

        try {
            LOGGER.debug("Creating Qdrant client for validation: {}:{}, TLS: {}", hostname, port, useTls);

            QdrantGrpcClient.Builder builder = QdrantGrpcClient.newBuilder(hostname, port, useTls);

            if (apiKey != null && !apiKey.trim().isEmpty()) {
                builder.withApiKey(apiKey);
            }

            client = new QdrantClient(builder.build());

            LOGGER.debug("Attempting to list Qdrant collections for connectivity test");

            ListenableFuture<List<String>> connectionTest = client.listCollectionsAsync();

            connectionTest.get(defaultConnectionTimeout, TimeUnit.SECONDS);

            LOGGER.info("Successfully validated Qdrant connection to {}:{}", hostname, port);
            return ConnectionValidationResult.successful();

        }
        catch (java.util.concurrent.TimeoutException e) {
            LOGGER.warn("Timeout during Qdrant connection validation", e);
            return ConnectionValidationResult.failed(
                    "Connection timeout - please check hostname, port and network connectivity");

        }
        catch (java.util.concurrent.ExecutionException e) {
            Throwable cause = e.getCause();
            LOGGER.warn("Failed to connect to Qdrant server", cause);

            if (cause instanceof io.grpc.StatusRuntimeException) {
                io.grpc.StatusRuntimeException grpcException = (io.grpc.StatusRuntimeException) cause;
                return switch (grpcException.getStatus().getCode()) {
                    case UNAVAILABLE -> {
                        if (useTls && cause.getMessage().contains("io exception")) {
                            yield ConnectionValidationResult.failed(
                                    "TLS connection failed - check certificates and hostname");
                        }
                        yield ConnectionValidationResult.failed(
                                "Qdrant server is unavailable - please check if the server is running");
                    }
                    case UNAUTHENTICATED -> ConnectionValidationResult.failed(
                            "Authentication failed - please check API key");
                    case PERMISSION_DENIED -> ConnectionValidationResult.failed(
                            "Permission denied - please check API key permissions");
                    case DEADLINE_EXCEEDED -> ConnectionValidationResult.failed(
                            "Connection timeout - please check network connectivity");
                    default -> ConnectionValidationResult.failed(
                            "gRPC error: " + grpcException.getStatus().getDescription());
                };
            }

            return ConnectionValidationResult.failed("Failed to connect to Qdrant: " + cause.getMessage());

        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.warn("Qdrant connection validation was interrupted", e);
            return ConnectionValidationResult.failed("Connection validation was interrupted");

        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Qdrant connection validation", e);
            return ConnectionValidationResult.failed("Generic error while connecting to Qdrant server: " + e.getMessage());

        }
        finally {
            if (client != null) {
                try {
                    LOGGER.debug("Closing Qdrant client");
                    client.close();
                }
                catch (Exception e) {
                    LOGGER.warn("Error closing Qdrant client", e);
                }
            }
        }
    }

    /**
     * Extracts port value from configuration, using default if not specified.
     */
    private int getPortValue(Map<String, Object> config) {
        Object portValue = config.get(PORT_KEY);
        if (portValue instanceof Integer) {
            return (Integer) portValue;
        }
        else if (portValue instanceof String) {
            return Integer.parseInt((String) portValue);
        }
        else if (portValue instanceof Number) {
            return ((Number) portValue).intValue();
        }
        return DEFAULT_PORT;
    }

    /**
     * Extracts boolean value from configuration with default fallback.
     */
    private boolean getBooleanValue(Map<String, Object> config, String key, boolean defaultValue) {
        Object value = config.get(key);
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        else if (value instanceof String) {
            return Boolean.parseBoolean((String) value);
        }
        return defaultValue;
    }

    /**
     * Extracts string value from configuration.
     */
    private String getStringValue(Map<String, Object> config, String key) {
        Object value = config.get(key);
        return value != null ? value.toString() : null;
    }
}
