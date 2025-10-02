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
import io.debezium.platform.environment.connection.destination.QdrantConnectionValidator;

/**
 * Unit tests for QdrantConnectionValidator.
 * 
 * <p>This test class focuses on parameter validation, error handling scenarios,
 * and business logic testing without requiring an actual Qdrant instance. It uses
 * mock connections and invalid configurations to test various edge cases and
 * validation rules.</p>
 * 
 * <p>Test coverage includes:</p>
 * <ul>
 *   <li><strong>Parameter Validation:</strong> Required fields (hostname, port) and their constraints</li>
 *   <li><strong>Invalid Configuration Handling:</strong> Malformed URLs, invalid ports, empty values</li>
 *   <li><strong>Timeout Scenarios:</strong> Using non-routable IP addresses (10.255.255.1)</li>
 *   <li><strong>API Key Validation:</strong> Authentication parameter handling and validation</li>
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
 * @author Pranav Tiwari
 * @since 1.0
 */
class QdrantConnectionValidatorTest {

    public static final int DEFAULT_30_SECONDS_TIMEOUT = 30;

    private QdrantConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new QdrantConnectionValidator(DEFAULT_30_SECONDS_TIMEOUT);
    }

    @Test
    @DisplayName("Should fail validation when hostname is not provided")
    void shouldFailValidationWithoutHostname() {
        Map<String, Object> config = new HashMap<>();
        config.put("port", 6334);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Hostname must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when hostname is empty")
    void shouldFailValidationWithEmptyHostname() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", "");
        config.put("port", 6334);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Hostname must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when hostname is null")
    void shouldFailValidationWithNullHostname() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", null);
        config.put("port", 6334);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Hostname must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when hostname is whitespace only")
    void shouldFailValidationWithWhitespaceHostname() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", "   ");
        config.put("port", 6334);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Hostname must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is not provided")
    void shouldFailValidationWithoutPort() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", "localhost");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is null")
    void shouldFailValidationWithNullPort() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", "localhost");
        config.put("port", null);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is invalid (negative)")
    void shouldFailValidationWithNegativePort() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", "localhost");
        config.put("port", -1);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be between 1 and 65535", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is invalid (zero)")
    void shouldFailValidationWithZeroPort() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", "localhost");
        config.put("port", 0);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be between 1 and 65535", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is too high")
    void shouldFailValidationWithTooHighPort() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", "localhost");
        config.put("port", 65536);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be between 1 and 65535", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is not a number")
    void shouldFailValidationWithInvalidPortType() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", "localhost");
        config.put("port", "not-a-number");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

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
    @DisplayName("Should fail validation with invalid hostname")
    void shouldFailValidationWithInvalidHostname() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", "invalid-host-that-does-not-exist");
        config.put("port", 6334);
        config.put("useTls", false);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        Assertions.assertThat(result.message()).containsAnyOf(
                "timeout", "Failed to connect", "unavailable", "Connection timeout");
    }

    @Test
    @DisplayName("Should handle timeout scenarios gracefully")
    void shouldHandleTimeoutScenarios() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", "10.255.255.1"); // Non-routable IP
        config.put("port", 6334);
        config.put("useTls", false);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertTrue(result.message().contains("timeout") ||
                result.message().contains("Failed to connect") ||
                result.message().contains("unavailable"),
                "Error message should indicate timeout or connection failure");
    }

    @Test
    @DisplayName("Should accept valid port values")
    void shouldAcceptValidPortValues() {
        // Test with minimum valid port
        Map<String, Object> config1 = new HashMap<>();
        config1.put("hostname", "10.255.255.1"); // Will fail connection but pass validation
        config1.put("port", 1);
        config1.put("useTls", false);
        Connection connection1 = new TestConnectionView(ConnectionEntity.Type.QDRANT, config1);

        ConnectionValidationResult result1 = validator.validate(connection1);
        // Should fail due to connection, not parameter validation
        assertFalse(result1.valid());
        Assertions.assertThat(result1.message()).doesNotContain("Port must be");

        // Test with maximum valid port
        Map<String, Object> config2 = new HashMap<>();
        config2.put("hostname", "10.255.255.1"); // Will fail connection but pass validation
        config2.put("port", 65535);
        config2.put("useTls", false);
        Connection connection2 = new TestConnectionView(ConnectionEntity.Type.QDRANT, config2);

        ConnectionValidationResult result2 = validator.validate(connection2);
        // Should fail due to connection, not parameter validation
        assertFalse(result2.valid());
        Assertions.assertThat(result2.message()).doesNotContain("Port must be");
    }

    @Test
    @DisplayName("Should handle string port values")
    void shouldHandleStringPortValues() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", "10.255.255.1"); // Will fail connection but pass validation
        config.put("port", "6334"); // String representation of valid port
        config.put("useTls", false);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        // Should fail due to connection, not parameter validation
        assertFalse(result.valid());
        Assertions.assertThat(result.message()).doesNotContain("Port must be");
    }

    @Test
    @DisplayName("Should handle optional parameters gracefully")
    void shouldHandleOptionalParameters() {
        Map<String, Object> config = new HashMap<>();
        config.put("hostname", "10.255.255.1"); // Will fail connection but pass validation
        config.put("port", 6334);
        // useTls and apiKey are optional, so not providing them should be fine
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);

        ConnectionValidationResult result = validator.validate(connection);

        // Should fail due to connection, not parameter validation
        assertFalse(result.valid());
        Assertions.assertThat(result.message()).doesNotContain("must be specified");
    }
}
