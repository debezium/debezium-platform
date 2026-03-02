/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.RabbitMqConnectionValidator;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(RabbitMqTestResource.class)
class RabbitMqConnectionValidatorIT {

    private static final int DEFAULT_TIMEOUT_SECONDS = 30;

    private RabbitMqConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new RabbitMqConnectionValidator(DEFAULT_TIMEOUT_SECONDS);
    }

    @Test
    @DisplayName("Should validate connection with valid RabbitMQ configuration")
    void shouldValidateSuccessfulConnection() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", RabbitMqTestResource.getContainer().getHost());
        config.put("port", RabbitMqTestResource.getContainer().getAmqpPort());
        config.put("username", RabbitMqTestResource.getContainer().getAdminUsername());
        config.put("password", RabbitMqTestResource.getContainer().getAdminPassword());

        Connection connection = new TestConnectionView(ConnectionEntity.Type.RABBITMQ, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed");
    }

    @Test
    @DisplayName("Should fail validation when host is missing")
    void shouldFailWhenHostMissing() {
        Map<String, Object> config = new HashMap<>();
        config.put("port", 5672);
        config.put("username", "guest");
        config.put("password", "guest");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.RABBITMQ, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation must fail when host is missing");
    }

    @Test
    @DisplayName("Should fail validation with invalid credentials")
    void shouldFailWithInvalidCredentials() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", RabbitMqTestResource.getContainer().getHost());
        config.put("port", RabbitMqTestResource.getContainer().getAmqpPort());
        config.put("username", "wrong");
        config.put("password", "wrong");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.RABBITMQ, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation must fail with bad credentials");
    }
}
