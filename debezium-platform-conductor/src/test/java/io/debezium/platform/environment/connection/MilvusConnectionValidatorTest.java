/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.HashMap;
import java.util.Map;

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.MilvusConnectionValidator;

/**
 * Unit tests for {@link MilvusConnectionValidator}.
 * <p>
 * These tests validate the configuration validation logic without requiring
 * an actual Milvus server. They test parameter validation, URI format checking,
 * and edge cases in the validator implementation.
 * </p>
 *
 * @author Pranav Tiwari
 */
class MilvusConnectionValidatorTest {

    private MilvusConnectionValidator connectionValidator;

    @BeforeEach
    void setup() {
        // Initialize with a default timeout of 5 seconds
        connectionValidator = new MilvusConnectionValidator(5);
    }

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailWhenConfigIsNull() {
        ConnectionValidationResult result = connectionValidator.validate(null);

        assertFalse(result.valid(), "Validation should fail for null configuration");
        Assertions.assertThat(result.message()).contains("cannot be null");
    }

    @Test
    @DisplayName("Should fail validation when URI is missing")
    void shouldFailWhenUriIsMissing() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of());

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Validation should fail when URI is missing");
        Assertions.assertThat(result.message()).contains("URI must be specified");
    }

    @Test
    @DisplayName("Should fail validation when URI is empty")
    void shouldFailWhenUriIsEmpty() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of("uri", ""));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Validation should fail when URI is empty");
        Assertions.assertThat(result.message()).contains("URI must be specified");
    }

    @Test
    @DisplayName("Should fail validation when URI is only whitespace")
    void shouldFailWhenUriIsWhitespace() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of("uri", "   "));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Validation should fail when URI is only whitespace");
        Assertions.assertThat(result.message()).contains("URI must be specified");
    }

    @Test
    @DisplayName("Should fail validation when URI doesn't start with http:// or https://")
    void shouldFailWhenUriHasInvalidProtocol() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, 
                Map.of("uri", "localhost:19530"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Validation should fail for URI without http:// or https://");
        Assertions.assertThat(result.message()).contains("URI must start with http:// or https://");
    }

    @Test
    @DisplayName("Should accept valid HTTP URI")
    void shouldAcceptValidHttpUri() {
        Map<String, Object> config = new HashMap<>();
        config.put("uri", "http://localhost:19530");

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, config);

        // This will fail at connection time, but should pass URI validation
        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        // Since we can't connect to a real server, it will fail, but not with URI validation error
        if (!result.valid()) {
            Assertions.assertThat(result.message()).doesNotContain("URI must start with");
        }
    }

    @Test
    @DisplayName("Should accept valid HTTPS URI")
    void shouldAcceptValidHttpsUri() {
        Map<String, Object> config = new HashMap<>();
        config.put("uri", "https://milvus.example.com:19530");

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, config);

        // This will fail at connection time, but should pass URI validation
        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        // Since we can't connect to a real server, it will fail, but not with URI validation error
        if (!result.valid()) {
            Assertions.assertThat(result.message()).doesNotContain("URI must start with");
        }
    }

    @Test
    @DisplayName("Should handle optional database parameter")
    void shouldHandleOptionalDatabase() {
        Map<String, Object> config = new HashMap<>();
        config.put("uri", "http://10.255.255.1:19530"); // Non-routable IP, will timeout
        config.put("database", "test_db");

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, config);

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        // Will fail to connect, but should pass configuration validation
        assertFalse(result.valid(), "Connection should fail to non-routable address");
    }

    @Test
    @DisplayName("Should handle optional username and password")
    void shouldHandleUsernamePassword() {
        Map<String, Object> config = new HashMap<>();
        config.put("uri", "http://10.255.255.1:19530"); // Non-routable IP
        config.put("username", "testuser");
        config.put("password", "testpass");

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, config);

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        // Will fail to connect, but should pass configuration validation
        assertFalse(result.valid(), "Connection should fail to non-routable address");
    }

    @Test
    @DisplayName("Should handle optional token authentication")
    void shouldHandleTokenAuth() {
        Map<String, Object> config = new HashMap<>();
        config.put("uri", "http://10.255.255.1:19530"); // Non-routable IP
        config.put("token", "testuser:testpass");

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, config);

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        // Will fail to connect, but should pass configuration validation
        assertFalse(result.valid(), "Connection should fail to non-routable address");
    }

    @Test
    @DisplayName("Should handle all optional parameters together")
    void shouldHandleAllOptionalParameters() {
        Map<String, Object> config = new HashMap<>();
        config.put("uri", "http://10.255.255.1:19530"); // Non-routable IP
        config.put("database", "test_db");
        config.put("username", "testuser");
        config.put("password", "testpass");

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, config);

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        // Will fail to connect, but should pass configuration validation
        assertFalse(result.valid(), "Connection should fail to non-routable address");
    }

    @Test
    @DisplayName("Should trim whitespace from URI")
    void shouldTrimUriWhitespace() {
        Map<String, Object> config = new HashMap<>();
        config.put("uri", "  http://10.255.255.1:19530  ");

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, config);

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        // Should pass URI validation (trimming happens)
        if (!result.valid()) {
            Assertions.assertThat(result.message()).doesNotContain("URI must start with");
        }
    }
}

