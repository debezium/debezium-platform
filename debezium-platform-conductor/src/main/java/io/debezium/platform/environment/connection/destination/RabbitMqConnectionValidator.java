/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeoutException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.rabbitmq.client.ConnectionFactory;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionConfigUtils;
import io.debezium.platform.environment.connection.ConnectionValidator;

/**
 * Validates connectivity to a RabbitMQ broker using the AMQP protocol.
 */
@Named("RABBITMQ")
@ApplicationScoped
public class RabbitMqConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(RabbitMqConnectionValidator.class);

    private static final String HOST = "host";
    private static final String PORT = "port";
    private static final String USERNAME = "username";
    private static final String PASSWORD = "password";
    private static final String VIRTUAL_HOST = "virtualHost";
    private static final String SSL_ENABLED = "ssl.enabled";

    private final int defaultConnectionTimeoutSeconds;

    public RabbitMqConnectionValidator(@ConfigProperty(name = "destinations.rabbitmq.connection.timeout", defaultValue = "60") int defaultConnectionTimeoutSeconds) {
        this.defaultConnectionTimeoutSeconds = defaultConnectionTimeoutSeconds;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        Map<String, Object> config = connectionConfig.getConfig();
        String host = ConnectionConfigUtils.getString(config, HOST);
        Integer port = ConnectionConfigUtils.getInteger(config, PORT);
        String username = ConnectionConfigUtils.getString(config, USERNAME);
        String password = ConnectionConfigUtils.getString(config, PASSWORD);

        if (ConnectionConfigUtils.isBlank(host) || port == null || port <= 0) {
            return ConnectionValidationResult.failed("Host and port must be specified");
        }
        if (ConnectionConfigUtils.isBlank(username) || ConnectionConfigUtils.isBlank(password)) {
            return ConnectionValidationResult.failed("Username and password must be specified");
        }

        boolean sslEnabled = ConnectionConfigUtils.getBoolean(config, SSL_ENABLED, false);
        String virtualHost = ConnectionConfigUtils.getString(config, VIRTUAL_HOST);

        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost(host);
        factory.setPort(port);
        factory.setUsername(username);
        factory.setPassword(password);
        factory.setConnectionTimeout((int) Duration.ofSeconds(defaultConnectionTimeoutSeconds).toMillis());
        if (!ConnectionConfigUtils.isBlank(virtualHost)) {
            factory.setVirtualHost(virtualHost);
        }
        if (sslEnabled) {
            try {
                factory.useSslProtocol();
            }
            catch (Exception e) {
                LOGGER.error("Failed to enable SSL for RabbitMQ connection", e);
                return ConnectionValidationResult.failed("Failed to enable SSL: " + e.getMessage());
            }
        }

        try (com.rabbitmq.client.Connection ignored = factory.newConnection()) {
            return ConnectionValidationResult.successful();
        }
        catch (IOException | TimeoutException e) {
            LOGGER.warn("Unable to connect to RabbitMQ at {}:{}", host, port, e);
            return ConnectionValidationResult.failed("Failed to connect to RabbitMQ: " + e.getMessage());
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during RabbitMQ connection validation", e);
            return ConnectionValidationResult.failed("Unexpected error: " + e.getMessage());
        }
    }

}