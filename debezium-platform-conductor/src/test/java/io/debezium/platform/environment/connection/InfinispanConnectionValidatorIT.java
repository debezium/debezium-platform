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
import org.testcontainers.containers.GenericContainer;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.InfinispanConnectionValidator;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(value = InfinispanTestResource.class, restrictToAnnotatedClass = true)
public class InfinispanConnectionValidatorIT {

    private static final int DEFAULT_TIMEOUT_SECONDS = 30;
    private InfinispanConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new InfinispanConnectionValidator(DEFAULT_TIMEOUT_SECONDS);
    }

    @Test
    @DisplayName("Should successfully validate connection with valid Infinispan configuration")
    void shouldValidateSuccessfulConnection() {
        GenericContainer<?> container = InfinispanTestResource.getContainer();

        Map<String, Object> config = new HashMap<>();
        config.put("server.host", container.getHost());
        config.put("server.port", container.getMappedPort(11222));
        config.put("cache", "testCache");
        config.put("user", "admin");
        config.put("password", "password");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.INFINISPAN, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed");
    }

    @Test
    @DisplayName("Should fail validation when server host is not provided")
    void shouldFailValidationWithoutServerHost() {
        Map<String, Object> config = new HashMap<>();
        config.put("cache", "testCache");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.INFINISPAN, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Server host must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when server host is null")
    void shouldFailValidationWithNullServerHost() {
        Map<String, Object> config = new HashMap<>();
        config.put("server.host", null);
        config.put("cache", "testCache");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.INFINISPAN, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Server host must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when server host is empty")
    void shouldFailValidationWithEmptyServerHost() {
        Map<String, Object> config = new HashMap<>();
        config.put("server.host", "");
        config.put("cache", "testCache");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.INFINISPAN, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Server host must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when cache name is not provided")
    void shouldFailValidationWithoutCache() {
        Map<String, Object> config = new HashMap<>();
        config.put("server.host", "localhost");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.INFINISPAN, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Cache name must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when cache name is empty")
    void shouldFailValidationWithEmptyCache() {
        Map<String, Object> config = new HashMap<>();
        config.put("server.host", "localhost");
        config.put("cache", "");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.INFINISPAN, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Cache name must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when cache name is null")
    void shouldFailValidationWithNullCache() {
        Map<String, Object> config = new HashMap<>();
        config.put("server.host", "localhost");
        config.put("cache", null);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.INFINISPAN, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Cache name must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWithNullConnection() {
        ConnectionValidationResult result = validator.validate(null);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection configuration cannot be null", result.message());
    }

    @Test
    @DisplayName("Should fail validation when connection config map is null")
    void shouldFailValidationWithNullConfigMap() {
        Connection connection = new TestConnectionView(ConnectionEntity.Type.INFINISPAN, null);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection configuration map cannot be null", result.message());
    }

    @Test
    @DisplayName("Should fail validation when server port is not a valid integer")
    void shouldFailValidationWithInvalidPort() {
        Map<String, Object> config = new HashMap<>();
        config.put("server.host", "localhost");
        config.put("server.port", "abc");
        config.put("cache", "testCache");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.INFINISPAN, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertTrue(result.message().contains("Invalid server port value"));
    }

    @Test
    @DisplayName("Should fail validation with unreachable server")
    void shouldFailValidationWithUnreachableServer() {
        Map<String, Object> config = new HashMap<>();
        config.put("server.host", "localhost");
        config.put("server.port", 19999);
        config.put("cache", "testCache");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.INFINISPAN, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertTrue(result.message().contains("Failed to connect"));
    }

    @Test
    @DisplayName("Should handle timeout scenarios gracefully")
    void shouldHandleTimeoutScenarios() {
        Map<String, Object> config = new HashMap<>();
        config.put("server.host", "10.255.255.1");
        config.put("server.port", 11222);
        config.put("cache", "testCache");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.INFINISPAN, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertTrue(result.message().contains("Failed to connect"));
    }

    @Test
    @DisplayName("Should successfully validate connection without optional fields")
    void shouldValidateSuccessfulConnectionWithoutOptionalFields() {
        GenericContainer<?> container = InfinispanTestResource.getContainer();

        Map<String, Object> config = new HashMap<>();
        config.put("server.host", container.getHost());
        config.put("server.port", container.getMappedPort(11222));
        config.put("cache", "testCache");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.INFINISPAN, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed without optional fields");
    }
}
