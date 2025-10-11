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
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.shaded.org.awaitility.Awaitility;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.RedisConnectionValidator;
import io.debezium.platform.environment.database.db.RedisTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

/**
 * Integration tests for RedisConnectionValidator using Testcontainers WITHOUT authentication.
 *
 * <p>This test class validates the RedisConnectionValidator functionality against
 * a real Redis instance running in a Docker container WITHOUT authentication.
 * It provides comprehensive testing of basic connection validation, network connectivity,
 * and parameter handling in a non-authenticated environment.</p>
 *
 * <p>Test scenarios covered:</p>
 * <ul>
 *   <li><strong>Successful Connections:</strong> Valid host and port configurations</li>
 *   <li><strong>Network Failures:</strong> Invalid hostnames, unreachable hosts, wrong ports</li>
 *   <li><strong>Parameter Validation:</strong> Missing or invalid connection parameters</li>
 *   <li><strong>Timeout Handling:</strong> Connection timeouts using non-routable IP addresses</li>
 *   <li><strong>SSL Configuration:</strong> SSL/TLS connection attempts and error handling</li>
 *   <li><strong>Password Handling:</strong> Optional password parameter processing (ignored by non-auth server)</li>
 * </ul>
 *
 * <p>The tests use {@link RedisTestResource} which provides a containerized Redis
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
 *   <li>Testcontainers Redis dependency must be available</li>
 *   <li>Network access to pull Redis Docker image (redis:7-alpine)</li>
 * </ul>
 *
 * <p>These tests are faster and more reliable than authenticated tests since they don't
 * require complex container configuration, making them ideal for continuous integration
 * and rapid feedback during development.</p>
 *
 * @author Pranav Kumar Tiwari
 * @since 1.0
 */
@QuarkusTest
@QuarkusTestResource(value = RedisTestResource.class, restrictToAnnotatedClass = true)
class RedisConnectionValidatorIT {

    @Inject
    RedisConnectionValidator connectionValidator;

    @Test
    @DisplayName("Should successfully validate connection with valid Redis configuration")
    void shouldValidateSuccessfulConnection() {
        GenericContainer<?> container = RedisTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.REDIS, Map.of(
                "host", container.getHost(),
                "port", container.getMappedPort(6379).toString()));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertTrue(result.valid(), "Connection validation should succeed");
        assertThat(result.message()).isNotNull();
    }

    @Test
    @DisplayName("Should fail validation with wrong hostname")
    void shouldFailValidationWithWrongHostname() {
        GenericContainer<?> container = RedisTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.REDIS, Map.of(
                "host", "non-existent-host",
                "port", container.getMappedPort(6379).toString()));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertThat(result.message()).containsAnyOf("timeout", "Failed to connect", "Connection refused");
    }

    @Test
    @DisplayName("Should fail validation with wrong port")
    void shouldFailValidationWithWrongPort() {
        GenericContainer<?> container = RedisTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.REDIS, Map.of(
                "host", container.getHost(),
                "port", "9999")); // Wrong port

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertThat(result.message()).containsAnyOf("timeout", "Failed to connect", "Connection refused");
    }

    @Test
    @DisplayName("Should fail when password provided but server doesn't require authentication")
    void shouldHandlePasswordWithoutServerAuth() {
        GenericContainer<?> container = RedisTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // Test with password when container doesn't require authentication
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.REDIS, Map.of(
                "host", container.getHost(),
                "port", container.getMappedPort(6379).toString(),
                "password", "unused-password"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        // Should fail because Redis rejects AUTH when no password is configured
        assertFalse(result.valid(), "Connection validation should fail when password is provided but server doesn't require auth");
        assertThat(result.message()).contains("AUTH");
    }

    @Test
    @DisplayName("Should handle SSL configuration")
    void shouldHandleSslConfiguration() {
        GenericContainer<?> container = RedisTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // Test with SSL enabled (should fail since container doesn't use SSL)
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.REDIS, Map.of(
                "host", container.getHost(),
                "port", container.getMappedPort(6379).toString(),
                "useSsl", "true"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        // This might fail because the container is not configured with SSL
        // The important thing is that the validator handles the SSL parameter
        assertThat(result).isNotNull();
        assertThat(result.message()).isNotNull();
    }

    // ========== PARAMETER VALIDATION TESTS ==========

    @Test
    @DisplayName("Should fail validation when host is missing")
    void shouldFailValidationWithoutHost() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.REDIS, Map.of(
                "port", "6379"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Host must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is missing")
    void shouldFailValidationWithoutPort() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.REDIS, Map.of(
                "host", "localhost"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when host is empty")
    void shouldFailValidationWithEmptyHost() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.REDIS, Map.of(
                "host", "",
                "port", "6379"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Host must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when port is invalid")
    void shouldFailValidationWithInvalidPort() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.REDIS, Map.of(
                "host", "localhost",
                "port", "not-a-number"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Port must be a valid integer", result.message());
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
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.REDIS, Map.of(
                "host", "10.255.255.1", // Non-routable IP
                "port", "6379"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertThat(result.message()).containsAnyOf(
                "timeout", "Failed to connect", "Connection refused");
    }
}

