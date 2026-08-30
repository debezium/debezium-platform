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
import io.debezium.platform.environment.connection.destination.RocketMqConnectionValidator;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(RocketMqTestResource.class)
class RocketMqConnectionValidatorIT {

    private static final int DEFAULT_TIMEOUT_SECONDS = 30;

    private RocketMqConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new RocketMqConnectionValidator(DEFAULT_TIMEOUT_SECONDS);
    }

    @Test
    @DisplayName("Should validate connection with valid RocketMQ configuration")
    void shouldValidateSuccessfulConnection() {
        Map<String, Object> config = new HashMap<>();
        config.put("producer.name.srv.addr", RocketMqTestResource.getNameServerAddress());
        config.put("producer.group", "debezium-validation");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_ROCKETMQ, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed");
    }

    @Test
    @DisplayName("Should validate connection when no producer group is configured")
    void shouldValidateSuccessfulConnectionWithoutProducerGroup() {
        Map<String, Object> config = new HashMap<>();
        config.put("producer.name.srv.addr", RocketMqTestResource.getNameServerAddress());

        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_ROCKETMQ, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed with the default producer group");
    }

    @Test
    @DisplayName("Should fail validation when the name server is unreachable")
    void shouldFailWhenNameServerUnreachable() {
        Map<String, Object> config = new HashMap<>();
        config.put("producer.name.srv.addr", RocketMqTestResource.getContainer().getHost() + ":1");
        config.put("producer.group", "debezium-validation");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_ROCKETMQ, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation must fail when the name server is unreachable");
    }
}
