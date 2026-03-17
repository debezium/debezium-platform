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
import org.infinispan.client.hotrod.RemoteCacheManager;
import org.infinispan.client.hotrod.configuration.ConfigurationBuilder;
import org.infinispan.client.hotrod.impl.ConfigurationProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionValidator;

/**
 * Implementation of {@link ConnectionValidator} for Infinispan connections.
 * <p>
 * This validator performs validation of Infinispan connection configurations
 * including server reachability and cache accessibility.
 * </p>
 *
 * <p>
 * The validation process includes:
 * <ul>
 *   <li>Server host and cache name verification</li>
 *   <li>Infinispan server connectivity verification via HotRod protocol</li>
 *   <li>Cache name presence verification</li>
 *   <li>Timeout handling for network issues</li>
 * </ul>
 * </p>
 *
 * @author Yuang Li
 */
@Named("INFINISPAN")
@ApplicationScoped
public class InfinispanConnectionValidator implements ConnectionValidator {
    private static final Logger LOGGER = LoggerFactory.getLogger(InfinispanConnectionValidator.class);

    private static final String SERVER_HOST_KEY = "server.host";
    private static final String SERVER_PORT_KEY = "server.port";
    private static final String CACHE_KEY = "cache";
    private static final String USER_KEY = "user";
    private static final String PASSWORD_KEY = "password";

    private static final String HOTROD_URI_WITH_AUTH = "hotrod://%s:%s@%s:%d";
    private static final String HOTROD_URI_NO_AUTH = "hotrod://%s:%d";

    private final int defaultConnectionTimeoutSeconds;

    public InfinispanConnectionValidator(
                                         @ConfigProperty(name = "destinations.infinispan.connection.timeout", defaultValue = "60") int defaultConnectionTimeoutSeconds) {
        this.defaultConnectionTimeoutSeconds = defaultConnectionTimeoutSeconds;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        try {
            LOGGER.debug("Starting Infinispan connection validation for connection: {}", connectionConfig.getName());

            Map<String, Object> infinispanConfig = connectionConfig.getConfig();

            if (infinispanConfig == null) {
                return ConnectionValidationResult.failed("Connection configuration map cannot be null");
            }

            if (!infinispanConfig.containsKey(SERVER_HOST_KEY) ||
                    infinispanConfig.get(SERVER_HOST_KEY) == null ||
                    infinispanConfig.get(SERVER_HOST_KEY).toString().isEmpty()) {
                return ConnectionValidationResult.failed("Server host must be specified");
            }

            if (!infinispanConfig.containsKey(CACHE_KEY) ||
                    infinispanConfig.get(CACHE_KEY) == null ||
                    infinispanConfig.get(CACHE_KEY).toString().isEmpty()) {
                return ConnectionValidationResult.failed("Cache name must be specified");
            }

            String serverHost = infinispanConfig.get(SERVER_HOST_KEY).toString();

            String cacheName = infinispanConfig.get(CACHE_KEY).toString();

            int serverPort = parsePort(infinispanConfig.get(SERVER_PORT_KEY));

            String user = infinispanConfig.get(USER_KEY) != null
                    ? infinispanConfig.get(USER_KEY).toString()
                    : null;

            String password = infinispanConfig.get(PASSWORD_KEY) != null
                    ? infinispanConfig.get(PASSWORD_KEY).toString()
                    : null;

            // Infinispan treats both-empty credentials as no-auth, but one-empty causes TransportException.
            boolean hasUser = user != null && !user.isEmpty();
            boolean hasPassword = password != null && !password.isEmpty();
            if (hasUser != hasPassword) {
                return ConnectionValidationResult.failed("User and password must both be provided for authentication");
            }

            return performConnectionValidation(serverHost, serverPort, cacheName, user, password);
        }
        catch (IllegalArgumentException e) {
            return ConnectionValidationResult.failed(e.getMessage());
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Infinispan connection validation", e);
            return ConnectionValidationResult.failed("Validation failed due to unexpected error: " + e.getMessage());
        }
    }

    /**
     * Performs the actual connection validation by attempting to connect to the
     * Infinispan server and verify cache accessibility.
     *
     * @param serverHost the Infinispan server hostname
     * @param serverPort the Infinispan server port
     * @param cacheName the Infinispan cache name to verify
     * @param user optional username for authentication
     * @param password optional password for authentication
     * @return ConnectionValidationResult indicating success or failure
     */
    private ConnectionValidationResult performConnectionValidation(String serverHost, int serverPort, String cacheName, String user, String password) {

        LOGGER.debug("Creating Infinispan RemoteCacheManager for validation");

        String serverUri;
        boolean hasUser = user != null && !user.isEmpty();
        boolean hasPassword = password != null && !password.isEmpty();

        if (hasUser && hasPassword) {
            serverUri = HOTROD_URI_WITH_AUTH.formatted(user, password, serverHost, serverPort);
        }
        else {
            serverUri = HOTROD_URI_NO_AUTH.formatted(serverHost, serverPort);
        }

        ConfigurationBuilder clientConfig = new ConfigurationBuilder();
        clientConfig.uri(serverUri);
        clientConfig.connectionTimeout(defaultConnectionTimeoutSeconds * 1000);
        clientConfig.socketTimeout(defaultConnectionTimeoutSeconds * 1000);

        try (RemoteCacheManager remoteCacheManager = new RemoteCacheManager(clientConfig.build())) {
            remoteCacheManager.getCache(cacheName);
            LOGGER.debug("Successfully connected to Infinispan server at {}:{}", serverHost, serverPort);
            return ConnectionValidationResult.successful();
        }
        catch (Exception e) {
            LOGGER.warn("Failed to connect to Infinispan server at {}:{}", serverHost, serverPort, e);
            return ConnectionValidationResult.failed("Failed to connect to Infinispan server: " + e.getMessage());
        }
    }

    /**
     * Parses the server port from the configuration value.
     *
     * @param portValue the port value from configuration, may be null
     * @return the parsed port number, or the default HotRod port if not specified
     * @throws IllegalArgumentException if the port value cannot be parsed as an integer
     */
    private int parsePort(Object portValue) {
        if (portValue == null) {
            return ConfigurationProperties.DEFAULT_HOTROD_PORT;
        }
        try {
            return Integer.parseInt(portValue.toString());
        }
        catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    "Invalid server port value: " + portValue + ". Port must be a valid integer.");
        }
    }
}
