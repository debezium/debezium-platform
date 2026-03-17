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
import java.util.concurrent.TimeUnit;

import jakarta.inject.Inject;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.pulsar.PulsarContainer;
import org.testcontainers.shaded.org.awaitility.Awaitility;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.PulsarConnectionValidator;
import io.debezium.platform.environment.destination.ApachePulsarTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(value = ApachePulsarTestResource.class, restrictToAnnotatedClass = true)
class PulsarConnectionValidatorIT {
    @Inject
    PulsarConnectionValidator validator;

    @Test
    @DisplayName("Should successfully validate connection with valid Pulsar configuration")
    void shouldValidateSuccessfulConnection() {
        PulsarContainer container = ApachePulsarTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Map<String, Object> config = new HashMap<>();
        config.put("serviceHttpUrl", container.getHttpServiceUrl());
        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed");
    }

    @Test
    @DisplayName("Should fail validation without ServiceHttpUrl")
    void shouldFailValidationWithoutServiceHttpUrl() {
        Map<String, Object> config = new HashMap<>();
        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);
        assertFalse(result.valid(), "Connection validation should fail without ServiceHttpUrl");
        assertEquals("Service HTTP URL must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when ServiceHttpUrl is empty")
    void shouldFailValidationWithEmptyServiceHttpUrl() {
        Map<String, Object> config = new HashMap<>();
        config.put("serviceHttpUrl", "");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);
        assertFalse(result.valid(), "Connection validation should fail without ServiceHttpUrl");
        assertEquals("Service HTTP URL must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when ServiceHttpUrl is null")
    void shouldFailValidationWithNullServiceHttpUrl() {
        Map<String, Object> config = new HashMap<>();
        config.put("serviceHttpUrl", null);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);
        assertFalse(result.valid(), "Connection validation should fail without ServiceHttpUrl");
        assertEquals("Service HTTP URL must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation with invalid ServiceHttpUrl -- missing URL scheme")
    void shouldFailValidationWithoutURLSchemeForServiceHttpUrl() {
        Map<String, Object> config = new HashMap<>();
        config.put("serviceHttpUrl", "invalid-host:8080");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);
        assertFalse(result.valid(), "Connection validation should fail with invalid ServiceHttpUrl");
        assertEquals("Configuration error", result.message());
    }

    @Test
    @DisplayName("Should fail validation with invalid host for ServiceHttpUrl")
    void shouldFailValidationWithInvalidHostForServiceHttpUrl() {
        Map<String, Object> config = new HashMap<>();
        config.put("serviceHttpUrl", "http://invalid-host:8080");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);
        assertFalse(result.valid(), "Connection validation should fail with invalid ServiceHttpUrl");
        assertEquals("Pulsar connection error", result.message());
    }

    @Test
    @DisplayName("Should handle timeout scenarios gracefully")
    void shouldHandleTimeoutScenarios() {
        Map<String, Object> config = new HashMap<>();
        config.put("serviceHttpUrl", "http://10.255.255.1:8080");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);
        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection timeout - please check the Pulsar admin URL and network connectivity", result.message());
    }
}
