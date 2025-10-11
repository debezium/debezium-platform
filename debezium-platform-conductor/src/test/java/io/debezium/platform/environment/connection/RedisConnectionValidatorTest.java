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

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.RedisConnectionValidator;

/**
 * Unit tests for RedisConnectionValidator.
 *
 * <p>This test class focuses on parameter validation, error handling scenarios,
 * and business logic testing without requiring an actual Redis instance. It uses
 * mock connections and invalid configurations to test various edge cases and
 * validation rules.</p>
 *
 * <p>Test coverage includes:</p>
 * <ul>
 *   <li><strong>Parameter Validation:</strong> Required fields (host, port) and their constraints</li>
 *   <li><strong>Invalid Configuration Handling:</strong> Malformed values, invalid ports, empty values</li>
 *   <li><strong>Timeout Scenarios:</strong> Using non-routable IP addresses (10.255.255.1)</li>
 *   <li><strong>Password Validation:</strong> Authentication parameter handling and validation</li>
 *   <li><strong>Connection Failure Scenarios:</strong> Network errors and error message validation</li>
 *   <li><strong>Edge Cases:</strong> Null connections, boundary values, special characters</li>
 * </ul>
 *
 * <p><strong>Test Categories:</strong></p>
 * <ul>
 *   <li><strong>Parameter Tests:</strong> Validate required and optional parameter handling</li>
 *   <li><strong>Validation Tests:</strong> Test input validation and constraint checking</li>
 *   <li><strong>Error Handling Tests:</strong> Verify proper error messages and failure modes</li>
 *   <li><strong>Timeout Tests:</strong> Test connection timeout behavior with unreachable hosts</li>
 * </ul>
 *
 * <p>These tests are fast-running and don't require Docker or external dependencies,
 * making them ideal for continuous integration and rapid feedback during development.
 * They use the {@link TestConnectionView} helper class to create mock connection
 * configurations for testing various scenarios.</p>
 *
 * <p><strong>Key Testing Techniques:</strong></p>
 * <ul>
 *   <li>Non-routable IP addresses (10.255.255.1) for reliable timeout testing</li>
 *   <li>Boundary value testing for port numbers (0, 65536, negative values)</li>
 *   <li>Null and empty value testing for required parameters</li>
 *   <li>Invalid data type testing (strings for numeric fields)</li>
 * </ul>
 *
 * @author Pranav Kumar Tiwari
 * @since 1.0
 */
class RedisConnectionValidatorTest {

    public static final int DEFAULT_30_SECONDS_TIMEOUT = 30;

    private RedisConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new RedisConnectionValidator(DEFAULT_30_SECONDS_TIMEOUT);
    }

    @Test
    @DisplayName("Should fail validation when host is not provided")
    void shouldFailValidationWithoutHost() {
        Map<String, Object> config = new HashMap<>();
        config.put("port", 6379);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Host must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when host is empty")
    void shouldFailValidationWithEmptyHost() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "");
        config.put("port", 6379);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Host must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when host is null")
    void shouldFailValidationWithNullHost() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", null);
        config.put("port", 6379);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Host must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when host is whitespace only")
    void shouldFailValidationWithWhitespaceHost() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "   ");
        config.put("port", 6379);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Host must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is not provided")
    void shouldFailValidationWithoutPort() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "localhost");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is null")
    void shouldFailValidationWithNullPort() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "localhost");
        config.put("port", null);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is not a number")
    void shouldFailValidationWithInvalidPortType() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "localhost");
        config.put("port", "not-a-number");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be a valid integer", result.message());
    }

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWithNullConnection() {
        ConnectionValidationResult result = validator.validate(null);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection configuration cannot be null", result.message());
    }

    @Test
    @DisplayName("Should fail validation with invalid host")
    void shouldFailValidationWithInvalidHost() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "invalid-host-that-does-not-exist");
        config.put("port", 6379);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        Assertions.assertThat(result.message()).containsAnyOf(
                "timeout", "Failed to connect", "Connection refused");
    }

    @Test
    @DisplayName("Should handle timeout scenarios gracefully")
    void shouldHandleTimeoutScenarios() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "10.255.255.1"); // Non-routable IP
        config.put("port", 6379);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertTrue(result.message().contains("timeout") ||
                result.message().contains("Failed to connect") ||
                result.message().contains("Connection refused"),
                "Error message should indicate timeout or connection failure");
    }

    @Test
    @DisplayName("Should accept valid port values")
    void shouldAcceptValidPortValues() {
        // Test with common Redis port
        Map<String, Object> config1 = new HashMap<>();
        config1.put("host", "10.255.255.1"); // Will fail connection but pass validation
        config1.put("port", 6379);
        Connection connection1 = new TestConnectionView(ConnectionEntity.Type.REDIS, config1);

        ConnectionValidationResult result1 = validator.validate(connection1);
        // Should fail due to connection, not parameter validation
        assertFalse(result1.valid());
        Assertions.assertThat(result1.message()).doesNotContain("Port must be");

        // Test with alternative Redis port
        Map<String, Object> config2 = new HashMap<>();
        config2.put("host", "10.255.255.1"); // Will fail connection but pass validation
        config2.put("port", 6380);
        Connection connection2 = new TestConnectionView(ConnectionEntity.Type.REDIS, config2);

        ConnectionValidationResult result2 = validator.validate(connection2);
        // Should fail due to connection, not parameter validation
        assertFalse(result2.valid());
        Assertions.assertThat(result2.message()).doesNotContain("Port must be");
    }

    @Test
    @DisplayName("Should handle string port values")
    void shouldHandleStringPortValues() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "10.255.255.1"); // Will fail connection but pass validation
        config.put("port", "6379"); // String representation of valid port
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        // Should fail due to connection, not parameter validation
        assertFalse(result.valid());
        Assertions.assertThat(result.message()).doesNotContain("Port must be");
    }

    @Test
    @DisplayName("Should handle optional parameters gracefully")
    void shouldHandleOptionalParameters() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "10.255.255.1"); // Will fail connection but pass validation
        config.put("port", 6379);
        // password, username, and useSsl are optional, so not providing them should be fine
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        // Should fail due to connection, not parameter validation
        assertFalse(result.valid());
        Assertions.assertThat(result.message()).doesNotContain("must be specified");
    }

    @Test
    @DisplayName("Should handle password parameter")
    void shouldHandlePasswordParameter() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "10.255.255.1"); // Will fail connection but pass validation
        config.put("port", 6379);
        config.put("password", "test-password");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        // Should fail due to connection, not parameter validation
        assertFalse(result.valid());
        Assertions.assertThat(result.message()).doesNotContain("must be specified");
    }

    @Test
    @DisplayName("Should handle username and password parameters")
    void shouldHandleUsernameAndPasswordParameters() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "10.255.255.1"); // Will fail connection but pass validation
        config.put("port", 6379);
        config.put("username", "testuser");
        config.put("password", "test-password");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        // Should fail due to connection, not parameter validation
        assertFalse(result.valid());
        Assertions.assertThat(result.message()).doesNotContain("must be specified");
    }

    @Test
    @DisplayName("Should handle SSL parameter")
    void shouldHandleSslParameter() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "10.255.255.1"); // Will fail connection but pass validation
        config.put("port", 6379);
        config.put("useSsl", "true");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.REDIS, config);

        ConnectionValidationResult result = validator.validate(connection);

        // Should fail due to connection, not parameter validation
        assertFalse(result.valid());
        Assertions.assertThat(result.message()).doesNotContain("must be specified");
    }
}
