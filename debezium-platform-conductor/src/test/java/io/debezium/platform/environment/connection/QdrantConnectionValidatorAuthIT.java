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
import io.debezium.platform.environment.database.db.QdrantTestResourceAuthenticated;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

/**
 * Integration tests for QdrantConnectionValidator using Testcontainers WITH authentication.
 *
 * <p>This test class validates the QdrantConnectionValidator functionality against
 * a real Qdrant instance running in a Docker container WITH API key authentication
 * enabled. It provides comprehensive testing of authenticated connections, security
 * validation, and real-world production-like scenarios.</p>
 *
 * <p>Test scenarios covered:</p>
 * <ul>
 *   <li><strong>Authentication Success:</strong> Valid API key connections</li>
 *   <li><strong>Authentication Failures:</strong> Invalid, missing, or empty API keys</li>
 *   <li><strong>Network Error Handling:</strong> Connection failures with authentication context</li>
 *   <li><strong>TLS with Authentication:</strong> Secure connections with API key validation</li>
 *   <li><strong>Parameter Validation:</strong> Required field validation in authenticated context</li>
 * </ul>
 *
 * <p>The tests use {@link QdrantTestResourceAuthenticated} which provides a containerized
 * Qdrant instance with authentication enabled. The container is configured with a test
 * API key that can be accessed via {@code QdrantTestResourceAuthenticated.getApiKey()}.</p>
 *
 * <p><strong>Test Categories:</strong></p>
 * <ul>
 *   <li><strong>Authentication Tests:</strong> Verify correct API key handling and rejection of invalid credentials</li>
 *   <li><strong>Network Tests:</strong> Ensure authentication errors are distinguished from network errors</li>
 *   <li><strong>Parameter Tests:</strong> Validate that parameter validation works in authenticated environments</li>
 * </ul>
 *
 * <p><strong>Prerequisites:</strong></p>
 * <ul>
 *   <li>Docker must be running on the test environment</li>
 *   <li>Testcontainers Qdrant dependency must be available</li>
 *   <li>Network access to pull Qdrant Docker image (qdrant/qdrant:v1.7.4)</li>
 *   <li>Container must support authentication configuration via environment variables</li>
 * </ul>
 *
 * <p><strong>Security Note:</strong> This test uses a predefined test API key
 * ("secure-test-api-key-123") which is only suitable for testing environments and should
 * never be used in production.</p>
 *
 * @author Pranav Tiwari
 * @since 1.0
 */
@QuarkusTest
@QuarkusTestResource(value = QdrantTestResourceAuthenticated.class, restrictToAnnotatedClass = true)
class QdrantConnectionValidatorAuthIT {

    @Inject
    QdrantConnectionValidator connectionValidator;

    @Test
    @DisplayName("Should authenticate successfully with correct API key")
    void shouldAuthenticateWithCorrectApiKey() {
        QdrantContainer container = QdrantTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // Use the correct API key
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", container.getHost(),
                "port", container.getMappedPort(6334),
                "useTls", false,
                "apiKey", QdrantTestResourceAuthenticated.getApiKey()));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertTrue(result.valid(), "Connection should succeed with correct API key");
        assertThat(result.message()).isNotNull();
    }

    @Test
    @DisplayName("Should fail authentication with incorrect API key")
    void shouldFailWithIncorrectApiKey() {
        QdrantContainer container = QdrantTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // Use wrong API key
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", container.getHost(),
                "port", container.getMappedPort(6334),
                "useTls", false,
                "apiKey", "wrong-api-key"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection should fail with incorrect API key");
        assertThat(result.message()).containsAnyOf(
                "Authentication failed", "UNAUTHENTICATED", "API key", "Permission denied");
    }

    @Test
    @DisplayName("Should fail authentication without API key")
    void shouldFailWithoutApiKeyWhenRequired() {
        QdrantContainer container = QdrantTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // Don't provide API key
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", container.getHost(),
                "port", container.getMappedPort(6334),
                "useTls", false));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection should fail without API key when auth is required");
        assertThat(result.message()).containsAnyOf(
                "Authentication failed", "UNAUTHENTICATED", "API key", "Permission denied");
    }

    @Test
    @DisplayName("Should fail authentication with empty API key")
    void shouldFailWithEmptyApiKey() {
        QdrantContainer container = QdrantTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // Provide empty API key
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", container.getHost(),
                "port", container.getMappedPort(6334),
                "useTls", false,
                "apiKey", ""));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection should fail with empty API key");
        assertThat(result.message()).containsAnyOf(
                "Authentication failed", "UNAUTHENTICATED", "API key", "Permission denied");
    }

    @Test
    @DisplayName("Should handle network errors with authentication")
    void shouldHandleNetworkErrorsWithAuth() {
        QdrantContainer container = QdrantTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // Test with wrong port but correct API key
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", container.getHost(),
                "port", 9999, // Wrong port
                "useTls", false,
                "apiKey", QdrantTestResourceAuthenticated.getApiKey()));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection should fail with wrong port");
        // Should be a connection error, not an auth error
        assertThat(result.message()).containsAnyOf("timeout", "unavailable", "Failed to connect");
    }

    @Test
    @DisplayName("Should handle TLS with authentication")
    void shouldHandleTlsWithAuth() {
        QdrantContainer container = QdrantTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // Test with TLS enabled and correct API key
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", container.getHost(),
                "port", container.getMappedPort(6334),
                "useTls", true,
                "apiKey", QdrantTestResourceAuthenticated.getApiKey()));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        // This might fail due to TLS configuration, but should handle API key correctly
        assertThat(result).isNotNull();
        assertThat(result.message()).isNotNull();
        // If it fails, it should be due to TLS, not authentication
        if (!result.valid()) {
            assertThat(result.message()).doesNotContainIgnoringCase("authentication");
        }
    }

    // ========== PARAMETER VALIDATION TESTS WITH AUTH ==========
    // These tests verify that parameter validation works even with auth enabled

    @Test
    @DisplayName("Should fail validation when hostname is missing (with auth)")
    void shouldFailValidationWithoutHostnameWithAuth() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "port", 6334,
                "useTls", false,
                "apiKey", QdrantTestResourceAuthenticated.getApiKey()));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Hostname must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is missing (with auth)")
    void shouldFailValidationWithoutPortWithAuth() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.QDRANT, Map.of(
                "hostname", "localhost",
                "useTls", false,
                "apiKey", QdrantTestResourceAuthenticated.getApiKey()));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when connection config is null (with auth)")
    void shouldFailValidationWithNullConnectionWithAuth() {
        ConnectionValidationResult result = connectionValidator.validate(null);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection configuration cannot be null", result.message());
    }
}
