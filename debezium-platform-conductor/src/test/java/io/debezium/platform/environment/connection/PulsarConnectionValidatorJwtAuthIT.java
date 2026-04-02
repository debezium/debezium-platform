/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static io.debezium.platform.environment.destination.ApachePulsarTestResourceJwtAuth.TEST_JWT_TOKEN;
import static io.debezium.platform.environment.destination.ApachePulsarTestResourceJwtAuth.TEST_TOKEN_SECRET_KEY;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import jakarta.inject.Inject;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.Container;
import org.testcontainers.pulsar.PulsarContainer;
import org.testcontainers.shaded.org.awaitility.Awaitility;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.PulsarConnectionValidator;
import io.debezium.platform.environment.destination.ApachePulsarTestResourceJwtAuth;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(value = ApachePulsarTestResourceJwtAuth.class, restrictToAnnotatedClass = true)
class PulsarConnectionValidatorJwtAuthIT {
    @Inject
    PulsarConnectionValidator validator;

    @Test
    @DisplayName("Should successfully validate connection with valid Pulsar configuration")
    void shouldValidateSuccessfulConnection() {
        PulsarContainer container = ApachePulsarTestResourceJwtAuth.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Map<String, Object> config = new HashMap<>();
        config.put("authScheme", "jwt");
        config.put("serviceHttpUrl", container.getHttpServiceUrl());
        config.put("jwtToken", TEST_JWT_TOKEN);

        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed");
    }

    @Test
    @DisplayName("Should fail validation with expired JWT token")
    void shouldFailValidationWithExpiredToken() throws Exception {
        PulsarContainer container = ApachePulsarTestResourceJwtAuth.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // Generate an expired token using Pulsar CLI
        Container.ExecResult expiredTokenResult = container.execInContainer(
                "bin/pulsar",
                "tokens",
                "create",
                "--secret-key",
                TEST_TOKEN_SECRET_KEY,
                "--subject",
                "admin",
                "--expiry-time",
                "1s");

        String expiredToken = expiredTokenResult.getStdout().trim();

        // Wait for token to expire
        Thread.sleep(2000);

        Map<String, Object> config = new HashMap<>();
        config.put("authScheme", "jwt");
        config.put("serviceHttpUrl", container.getHttpServiceUrl());
        config.put("jwtToken", expiredToken);

        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail with expired JWT token");
    }

    @Test
    @DisplayName("Should fail validation with invalid JWT token")
    void shouldFailValidationWithInvalidJwtToken() {
        PulsarContainer container = ApachePulsarTestResourceJwtAuth.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Map<String, Object> config = new HashMap<>();
        config.put("authScheme", "jwt");
        config.put("serviceHttpUrl", container.getHttpServiceUrl());
        config.put("jwtToken", "invalid-token-12345");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail with invalid JWT token");
    }

    @Test
    @DisplayName("Should fail validation with missing JWT token when required")
    void shouldFailValidationWithMissingJwtToken() {
        PulsarContainer container = ApachePulsarTestResourceJwtAuth.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Map<String, Object> config = new HashMap<>();
        config.put("authScheme", "jwt");
        config.put("serviceHttpUrl", container.getHttpServiceUrl());
        // No JWT token provided

        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail without JWT token");
    }

    @Test
    @DisplayName("Should fail validation with invalid host for ServiceHttpUrl")
    void shouldFailValidationWithInvalidHostForServiceHttpUrl() {
        Map<String, Object> config = new HashMap<>();
        config.put("authScheme", "jwt");
        config.put("serviceHttpUrl", "http://invalid-host:8080");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);
        assertFalse(result.valid(), "Connection validation should fail with invalid ServiceHttpUrl");
        assertEquals("JWT token is missing or blank", result.message());
    }

    @Test
    @DisplayName("Should handle timeout scenarios gracefully")
    void shouldHandleTimeoutScenarios() {
        Map<String, Object> config = new HashMap<>();
        config.put("authScheme", "jwt");
        config.put("serviceHttpUrl", "http://10.255.255.1:8080");
        config.put("jwtToken", TEST_JWT_TOKEN);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);
        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection timeout - please check the Pulsar admin URL and network connectivity", result.message());
    }
}
