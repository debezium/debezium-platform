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

import redis.clients.jedis.DefaultJedisClientConfig;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.exceptions.JedisConnectionException;

/**
 * Redis connection validator with support for:
 * - Host/port config
 * - Optional username/password (Redis ACL support)
 * - Optional password only (classic Redis auth)
 */
@ApplicationScoped
@Named("REDIS")
public class RedisConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(RedisConnectionValidator.class);

    public static final int DEFAULT_PORT = 6379;

    private static final String PING_RESPONSE = "PONG";
    private static final String HOST_KEY = "host";
    private static final String PORT_KEY = "port";
    private static final String PASSWORD_KEY = "password";
    private static final String USERNAME_KEY = "username";

    private final Duration defaultTimeout;

    public RedisConnectionValidator(
                                    @ConfigProperty(name = "destinations.redis.connection.timeout") Duration defaultTimeout) {
        this.defaultTimeout = defaultTimeout;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        try {
            LOGGER.debug("Starting Redis connection validation for: {}", connectionConfig.getName());

            Map<String, Object> redisConfig = connectionConfig.getConfig();
            if (redisConfig == null) {
                return ConnectionValidationResult.failed("Connection configuration map cannot be null");
            }

            ConfigurationValidationResult configValidation = validateConfiguration(redisConfig);
            if (!configValidation.valid()) {
                return ConnectionValidationResult.failed(configValidation.message());
            }

            return performConnectionValidation(configValidation);
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Redis connection validation", e);
            return ConnectionValidationResult.failed("Unexpected error: " + e.getMessage());
        }
    }

    private ConfigurationValidationResult validateConfiguration(Map<String, Object> config) {
        String host = getStringConfig(config, HOST_KEY);
        if (Strings.isNullOrBlank(host)) {
            return ConfigurationValidationResult.failed("Host must be specified");
        }

        String portStr = getStringConfig(config, PORT_KEY);
        if (portStr == null) {
            return ConfigurationValidationResult.failed("Port must be specified");
        }

        int port;
        try {
            port = Integer.parseInt(portStr);
        }
        catch (NumberFormatException e) {
            return ConfigurationValidationResult.failed("Port must be a valid integer");
        }

        String username = getStringConfig(config, USERNAME_KEY);

        String password = getStringConfig(config, PASSWORD_KEY);

        return ConfigurationValidationResult.successful(host, port, username, password);
    }


    private String getStringConfig(Map<String, Object> config, String key) {
        Object value = config.get(key);
        return value != null ? value.toString() : null;
    }

    private ConnectionValidationResult performConnectionValidation(ConfigurationValidationResult configValidation) {
        String host = configValidation.host();
        int port = configValidation.port();
        String username = configValidation.username();
        String password = configValidation.password();

        // Build Jedis client config with authentication
        // Note: SSL is not supported for now as it requires handling keys and certificates globally
        DefaultJedisClientConfig.Builder configBuilder = DefaultJedisClientConfig.builder()
                .connectionTimeoutMillis((int) defaultTimeout.toMillis())
                .socketTimeoutMillis((int) defaultTimeout.toMillis());

        // Add authentication credentials to the config
        if (!Strings.isNullOrEmpty(username) && password != null) {
            // Redis 6+ ACL auth with username and password
            LOGGER.debug("Configuring authentication with username and password");
            configBuilder.user(username).password(password);
        }
        else if (!Strings.isNullOrEmpty(password)) {
            // Classic password-only auth
            LOGGER.debug("Configuring authentication with password only");
            configBuilder.password(password);
        }
        else {
            LOGGER.debug("No authentication credentials provided");
        }

        LOGGER.debug("Connecting to Redis at {}:{}", host, port);
        try (Jedis jedis = new Jedis(host, port, configBuilder.build())) {
            // Send a simple PING command to test the connection
            String response = jedis.ping();
            LOGGER.debug("Redis PING response: {}", response);

            if (PING_RESPONSE.equalsIgnoreCase(response)) {
                return ConnectionValidationResult.successful();
            }
            else {
                return ConnectionValidationResult.failed("Unexpected PING response from Redis: " + response);
            }
        }
        catch (JedisConnectionException e) {
            LOGGER.warn("Failed to connect to Redis server", e);
            return ConnectionValidationResult.failed("Failed to connect to Redis: " + e.getMessage());
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Redis validation", e);
            return ConnectionValidationResult.failed("Unexpected error: " + e.getMessage());
        }
    }

    /**
     * Record to hold validated configuration values to avoid re-parsing
     */
    private record ConfigurationValidationResult(
            boolean valid,
            String message,
            String host,
            int port,
            String username,
            String password) {

        public static ConfigurationValidationResult failed(String message) {
            return new ConfigurationValidationResult(false, message, null, 0, null, null);
        }

        public static ConfigurationValidationResult successful(String host, int port, String username, String password) {
            return new ConfigurationValidationResult(true, null, host, port, username, password);
        }
    }
}
