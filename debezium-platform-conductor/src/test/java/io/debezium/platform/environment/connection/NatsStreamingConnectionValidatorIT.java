/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import io.debezium.platform.environment.connection.destination.NatsStreamingConnectionValidator;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(NatsStreamingTestResource.class)
class NatsStreamingConnectionValidatorIT {

    private static final int DEFAULT_TIMEOUT_SECONDS = 30;

    private NatsStreamingConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new NatsStreamingConnectionValidator(DEFAULT_TIMEOUT_SECONDS);
    }

    @Test
    @DisplayName("Should validate connection with valid NATS Streaming configuration")
    void shouldValidateSuccessfulConnection() {
        String url = "nats://" + NatsStreamingTestResource.getContainer().getHost()
                + ":" + NatsStreamingTestResource.getContainer().getMappedPort(4222);

        Map<String, Object> config = new HashMap<>();
        config.put("url", url);
        config.put("cluster.id", "test-cluster");
        config.put("client.id", "test-client");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.NATS_STREAMING, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed");
    }

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWithNullConnection() {
        ConnectionValidationResult result = validator.validate(null);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection configuration cannot be null", result.message());
    }

    @Test
    @DisplayName("Should fail validation when url is missing")
    void shouldFailWhenUrlMissing() {
        Map<String, Object> config = new HashMap<>();
        config.put("cluster.id", "test-cluster");
        config.put("client.id", "test-client");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.NATS_STREAMING, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation must fail when url is missing");
        assertEquals("URL must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when cluster.id is missing")
    void shouldFailWhenClusterIdMissing() {
        Map<String, Object> config = new HashMap<>();
        config.put("url", "nats://localhost:4222");
        config.put("client.id", "test-client");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.NATS_STREAMING, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation must fail when cluster.id is missing");
        assertEquals("Cluster ID must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when client.id is missing")
    void shouldFailWhenClientIdMissing() {
        Map<String, Object> config = new HashMap<>();
        config.put("url", "nats://localhost:4222");
        config.put("cluster.id", "test-cluster");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.NATS_STREAMING, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation must fail when client.id is missing");
        assertEquals("Client ID must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when NATS server is unreachable")
    void shouldFailWhenServerUnreachable() {
        Map<String, Object> config = new HashMap<>();
        config.put("url", "nats://localhost:14222");
        config.put("cluster.id", "test-cluster");
        config.put("client.id", "test-client");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.NATS_STREAMING, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation must fail when server is unreachable");
    }
}