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
import redis.clients.jedis.JedisClientConfig;
import redis.clients.jedis.exceptions.JedisConnectionException;

/**
 * Redis connection validator with support for:
 * - Host/port config
 * - Optional username/password (Redis ACL support)
 * - Optional password only (classic Redis auth)
 * - Optional TLS/SSL connection
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
    private static final String USE_SSL_KEY = "ssl.enabled"; // "true" or "false"

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

            // Validate configuration and parse port early to avoid re-parsing later
            String portStr = getStringConfig(redisConfig, PORT_KEY);
            ConnectionValidationResult configValidation = validateConfiguration(redisConfig, portStr);
            if (!configValidation.valid()) {
                return configValidation;
            }

            int port = Integer.parseInt(portStr);
            return performConnectionValidation(redisConfig, port);
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Redis connection validation", e);
            return ConnectionValidationResult.failed("Unexpected error: " + e.getMessage());
        }
    }

    private ConnectionValidationResult validateConfiguration(Map<String, Object> config, String portStr) {
        String host = getStringConfig(config, HOST_KEY);
        if (Strings.isNullOrBlank(host)) {
            return ConnectionValidationResult.failed("Host must be specified");
        }
        if (hasLeadingOrTrailingWhitespace(host)) {
            return ConnectionValidationResult.failed("Host cannot contain leading or trailing whitespace");
        }

        if (portStr == null) {
            return ConnectionValidationResult.failed("Port must be specified");
        }

        // Validate port is a number and within valid range
        int port;
        try {
            port = Integer.parseInt(portStr);
        }
        catch (NumberFormatException e) {
            return ConnectionValidationResult.failed("Port must be a valid integer");
        }

        if (port <= 0 || port > 65535) {
            return ConnectionValidationResult.failed("Port must be between 1 and 65535");
        }

        String username = getStringConfig(config, USERNAME_KEY);
        if (username != null && hasLeadingOrTrailingWhitespace(username)) {
            return ConnectionValidationResult.failed("Username cannot contain leading or trailing whitespace");
        }

        String useSslValue = getStringConfig(config, USE_SSL_KEY);
        if (useSslValue != null) {
            if (hasLeadingOrTrailingWhitespace(useSslValue)) {
                return ConnectionValidationResult.failed("ssl.enabled cannot contain leading or trailing whitespace");
            }
            if (!useSslValue.equalsIgnoreCase("true") && !useSslValue.equalsIgnoreCase("false")) {
                return ConnectionValidationResult.failed("ssl.enabled must be 'true' or 'false' if specified");
            }
        }

        return ConnectionValidationResult.successful();
    }

    private boolean hasLeadingOrTrailingWhitespace(String value) {
        return !value.equals(value.trim());
    }

    private String getStringConfig(Map<String, Object> config, String key) {
        Object value = config.get(key);
        return value != null ? value.toString() : null;
    }

    private ConnectionValidationResult performConnectionValidation(Map<String, Object> config, int port) {
        String host = getStringConfig(config, HOST_KEY);

        String username = getStringConfig(config, USERNAME_KEY);
        String password = getStringConfig(config, PASSWORD_KEY);

        boolean useSsl = false;
        String useSslValue = getStringConfig(config, USE_SSL_KEY);
        if (useSslValue != null) {
            useSsl = Boolean.parseBoolean(useSslValue);
        }

        Jedis jedis = null;
        try {
            LOGGER.debug("Connecting to Redis at {}:{} SSL={}", host, port, useSsl);

            // Build Jedis client config with authentication and SSL
            DefaultJedisClientConfig.Builder configBuilder = DefaultJedisClientConfig.builder()
                    .ssl(useSsl)
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

            JedisClientConfig clientConfig = configBuilder.build();
            jedis = new Jedis(host, port, clientConfig);

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
