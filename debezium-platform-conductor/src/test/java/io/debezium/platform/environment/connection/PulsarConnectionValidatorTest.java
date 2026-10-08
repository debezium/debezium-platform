/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.PulsarConnectionValidator;
import io.debezium.platform.environment.connection.destination.pulsar.PulsarAdminProvider;
import io.debezium.platform.environment.connection.destination.pulsar.PulsarAuthHandler;
import io.debezium.platform.environment.connection.destination.pulsar.PulsarAuthHandlerFactory;

/**
 * Plain JUnit 5 tests with no {@code @QuarkusTest}. These tests validate only
 * the basic input validation logic of {@link PulsarConnectionValidator} without
 * requiring Quarkus application startup.
 *
 * <p>Only tests that don't require actual Pulsar connection or auth handler logic
 * are included here. Integration tests with real Pulsar instances are in
 * {@code PulsarConnectionValidatorIT}.
 */
public class PulsarConnectionValidatorTest {

    private PulsarConnectionValidator validator;
    private PulsarAuthHandlerFactory authHandlerFactory;
    private PulsarAuthHandler authHandler;

    @BeforeEach
    void setUp() {
        // Mock dependencies
        authHandlerFactory = mock(PulsarAuthHandlerFactory.class);
        authHandler = mock(PulsarAuthHandler.class);
        PulsarAdminProvider pulsarAdminProvider = mock(PulsarAdminProvider.class);
        int defaultConnectionTimeout = 30000;

        // Default behavior: auth handler does nothing (validation passes)
        when(authHandlerFactory.getAuthHandler(anyString())).thenReturn(authHandler);

        validator = new PulsarConnectionValidator(defaultConnectionTimeout, authHandlerFactory, pulsarAdminProvider);
    }

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWithNullConnection() {
        ConnectionValidationResult result = validator.validate(null);
        assertFalse(result.valid(), "Connection validation should fail with null connection");
        assertEquals("Connection configuration cannot be null", result.message());
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

        // Mock auth handler to throw IllegalArgumentException for invalid URL
        doThrow(new IllegalArgumentException("authority component is missing in service uri : invalid-host:8080"))
                .when(authHandler).validate(any());

        ConnectionValidationResult result = validator.validate(connection);
        assertFalse(result.valid(), "Connection validation should fail with invalid ServiceHttpUrl");
        assertEquals("authority component is missing in service uri : invalid-host:8080", result.message());
    }
}