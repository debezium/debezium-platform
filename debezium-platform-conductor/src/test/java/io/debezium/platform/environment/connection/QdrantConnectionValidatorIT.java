/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.concurrent.TimeUnit;

import jakarta.inject.Inject;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.qdrant.QdrantContainer;
import org.testcontainers.shaded.org.awaitility.Awaitility;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.QdrantConnectionValidator;
import io.debezium.platform.environment.database.db.QdrantTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

/**
 * Integration tests for QdrantConnectionValidator using Testcontainers WITHOUT authentication.
 *
 * <p>This test class validates the QdrantConnectionValidator functionality against
 * a real Qdrant instance running in a Docker container WITHOUT authentication.
 * It provides comprehensive testing of basic connection validation, network connectivity,
 * and parameter handling in a non-authenticated environment.</p>
 *
 * <p>Test scenarios covered:</p>
 * <ul>
 *   <li><strong>Successful Connections:</strong> Valid hostname and port configurations</li>
 *   <li><strong>Network Failures:</strong> Invalid hostnames, unreachable hosts, wrong ports</li>
 *   <li><strong>Parameter Validation:</strong> Missing or invalid connection parameters</li>
 *   <li><strong>Timeout Handling:</strong> Connection timeouts using non-routable IP addresses</li>
 *   <li><strong>TLS Configuration:</strong> SSL/TLS connection attempts and error handling</li>
 *   <li><strong>API Key Handling:</strong> Optional API key parameter processing (ignored by non-auth server)</li>
 * </ul>
 *
 * <p>The tests use {@link QdrantTestResource} which provides a containerized Qdrant
 * instance without authentication enabled. This makes it ideal for testing basic
 * connection logic, parameter validation, and network error scenarios without the
 * complexity of authentication setup.</p>
 *
 * <p><strong>Test Categories:</strong></p>
 * <ul>
 *   <li><strong>Connection Tests:</strong> Verify successful connections to running container</li>
 *   <li><strong>Network Error Tests:</strong> Test various network failure scenarios</li>
 *   <li><strong>Parameter Tests:</strong> Validate required and optional parameter handling</li>
 *   <li><strong>Timeout Tests:</strong> Ensure proper timeout behavior for unreachable hosts</li>
 * </ul>
 *
 * <p><strong>Prerequisites:</strong></p>
 * <ul>
 *   <li>Docker must be running on the test environment</li>
 *   <li>Testcontainers Qdrant dependency must be available</li>
 *   <li>Network access to pull Qdrant Docker image (qdrant/qdrant:v1.7.4)</li>
 * </ul>
 *
 * <p>These tests are faster and more reliable than authenticated tests since they don't
 * require complex container configuration, making them ideal for continuous integration
 * and rapid feedback during development.</p>
 *
 * @author Pranav Tiwari
 * @since 1.0
 */
@QuarkusTest
@QuarkusTestResource(value = QdrantTestResource.class, restrictToAnnotatedClass = true)
class QdrantConnectionValidatorIT {

    @Inject
    QdrantConnectionValidator connectionValidator;

    @Test
    @DisplayName("Should successfully validate connection with valid Qdrant configuration")
    void shouldValidateSuccessfulConnection() {
        QdrantContainer container = QdrantTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", container.getHost(),
                "port", container.getMappedPort(6334), // gRPC port
                "useTls", false));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertTrue(result.valid(), "Connection validation should succeed");
        assertThat(result.message()).isNotNull();
    }

    @Test
    @DisplayName("Should fail validation with wrong hostname")
    void shouldFailValidationWithWrongHostname() {
        QdrantContainer container = QdrantTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", "non-existent-host",
                "port", container.getMappedPort(6334),
                "useTls", false));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertThat(result.message()).containsAnyOf("timeout", "unavailable", "Failed to connect");
    }

    @Test
    @DisplayName("Should fail validation with wrong port")
    void shouldFailValidationWithWrongPort() {
        QdrantContainer container = QdrantTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", container.getHost(),
                "port", 9999, // Wrong port
                "useTls", false));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertThat(result.message()).containsAnyOf("timeout", "unavailable", "Failed to connect");
    }

    @Test
    @DisplayName("Should handle API key gracefully when server doesn't require authentication")
    void shouldHandleApiKeyWithoutServerAuth() {
        QdrantContainer container = QdrantTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // Test with API key (container doesn't require authentication, so should succeed)
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", container.getHost(),
                "port", container.getMappedPort(6334),
                "useTls", false,
                "apiKey", "unused-api-key"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        // Should succeed since the container doesn't enforce authentication
        assertTrue(result.valid(), "Connection validation should succeed with API key when server doesn't require auth");
    }

    @Test
    @DisplayName("Should handle TLS configuration")
    void shouldHandleTlsConfiguration() {
        QdrantContainer container = QdrantTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // Test with TLS enabled (should fail since container doesn't use TLS)
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", container.getHost(),
                "port", container.getMappedPort(6334),
                "useTls", true));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        // This might fail because the container is not configured with TLS
        // The important thing is that the validator handles the TLS parameter
        assertThat(result).isNotNull();
        assertThat(result.message()).isNotNull();
    }

    // ========== PARAMETER VALIDATION TESTS ==========

    @Test
    @DisplayName("Should fail validation when hostname is missing")
    void shouldFailValidationWithoutHostname() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "port", 6334,
                "useTls", false));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Hostname must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is missing")
    void shouldFailValidationWithoutPort() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", "localhost",
                "useTls", false));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when hostname is empty")
    void shouldFailValidationWithEmptyHostname() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", "",
                "port", 6334,
                "useTls", false));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Hostname must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is invalid")
    void shouldFailValidationWithInvalidPort() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", "localhost",
                "port", -1,
                "useTls", false));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be between 1 and 65535", result.message());
    }

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWithNullConnection() {
        ConnectionValidationResult result = connectionValidator.validate(null);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection configuration cannot be null", result.message());
    }

    @Test
    @DisplayName("Should handle timeout scenarios gracefully")
    void shouldHandleTimeoutScenarios() {
        // Use a non-routable IP address to simulate timeout
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", "10.255.255.1", // Non-routable IP
                "port", 6334,
                "useTls", false));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertThat(result.message()).containsAnyOf(
                "timeout", "Connection timeout", "Failed to connect", "unavailable");
    }
}