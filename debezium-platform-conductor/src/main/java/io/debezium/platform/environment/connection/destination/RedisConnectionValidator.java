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

import redis.clients.jedis.DefaultJedisClientConfig;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisClientConfig;
import redis.clients.jedis.exceptions.JedisConnectionException;

/**
 * Redis connection validator with support for:
 * - Host/port config
 * - Optional username/password (Redis ACL support)
 * - Optional password only (classic Redis auth)
 * - Optional TLS/SSL connection
 * @author Pranav Kumar Tiwari
 */
@ApplicationScoped
@Named("REDIS")
public class RedisConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(RedisConnectionValidator.class);

    private static final String HOST_KEY = "host";
    private static final String PORT_KEY = "port";
    private static final String PASSWORD_KEY = "password";
    private static final String USERNAME_KEY = "username";
    private static final String USE_SSL_KEY = "useSsl"; // "true" or "false"

    private final int defaultTimeout;

    public RedisConnectionValidator(
                                    @ConfigProperty(name = "destinations.redis.connection.timeout") int defaultTimeout) {
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

            ConnectionValidationResult configValidation = validateConfiguration(redisConfig);
            if (!configValidation.valid()) {
                return configValidation;
            }

            return performConnectionValidation(redisConfig);
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Redis connection validation", e);
            return ConnectionValidationResult.failed("Unexpected error: " + e.getMessage());
        }
    }

    private ConnectionValidationResult validateConfiguration(Map<String, Object> config) {
        if (!config.containsKey(HOST_KEY) || config.get(HOST_KEY) == null ||
                config.get(HOST_KEY).toString().trim().isEmpty()) {
            return ConnectionValidationResult.failed("Host must be specified");
        }

        if (!config.containsKey(PORT_KEY) || config.get(PORT_KEY) == null) {
            return ConnectionValidationResult.failed("Port must be specified");
        }

        // Validate port is a number
        try {
            Integer.parseInt(config.get(PORT_KEY).toString());
        }
        catch (NumberFormatException e) {
            return ConnectionValidationResult.failed("Port must be a valid integer");
        }

        if (config.containsKey(USE_SSL_KEY)) {
            String useSslValue = config.get(USE_SSL_KEY).toString().trim().toLowerCase();
            if (!useSslValue.equals("true") && !useSslValue.equals("false")) {
                return ConnectionValidationResult.failed("useSsl must be 'true' or 'false' if specified");
            }
        }

        return ConnectionValidationResult.successful();
    }

    private ConnectionValidationResult performConnectionValidation(Map<String, Object> config) {
        String host = config.get(HOST_KEY).toString().trim();
        int port = Integer.parseInt(config.get(PORT_KEY).toString().trim());

        String username = config.containsKey(USERNAME_KEY) ? config.get(USERNAME_KEY).toString().trim() : null;
        String password = config.containsKey(PASSWORD_KEY) ? config.get(PASSWORD_KEY).toString() : null;

        boolean useSsl = false;
        if (config.containsKey(USE_SSL_KEY)) {
            useSsl = Boolean.parseBoolean(config.get(USE_SSL_KEY).toString().trim());
        }

        Jedis jedis = null;
        try {
            LOGGER.debug("Connecting to Redis at {}:{} SSL={}", host, port, useSsl);

            // Build Jedis client config with authentication and SSL
            DefaultJedisClientConfig.Builder configBuilder = DefaultJedisClientConfig.builder()
                    .ssl(useSsl)
                    .connectionTimeoutMillis(defaultTimeout * 1000)
                    .socketTimeoutMillis(defaultTimeout * 1000);

            // Add authentication credentials to the config
            if (username != null && !username.isEmpty() && password != null) {
                // Redis 6+ ACL auth with username and password
                LOGGER.debug("Configuring authentication with username and password");
                configBuilder.user(username).password(password);
            }
            else if (password != null && !password.isEmpty()) {
                // Classic password-only auth
                LOGGER.debug("Configuring authentication with password only");
                configBuilder.password(password);
            }
            else {
                LOGGER.debug("No authentication credentials provided");
            }

            JedisClientConfig clientConfig = configBuilder.build();
            jedis = new Jedis(host, port, clientConfig);

            // Send a simple PING command to test the connection
            String response = jedis.ping();
            LOGGER.debug("Redis PING response: {}", response);

            if ("PONG".equalsIgnoreCase(response)) {
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
        finally {
            if (jedis != null) {
                try {
                    jedis.close();
                }
                catch (Exception ex) {
                    LOGGER.warn("Error closing Redis client", ex);
                }
            }
        }
    }
}
