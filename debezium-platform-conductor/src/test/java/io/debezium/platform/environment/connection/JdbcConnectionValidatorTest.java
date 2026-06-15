/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.JdbcConnectionValidator;

class JdbcConnectionValidatorTest {

    private static final int DEFAULT_TIMEOUT = 5;

    private JdbcConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new JdbcConnectionValidator(DEFAULT_TIMEOUT);
    }

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWithNullConnection() {
        ConnectionValidationResult result = validator.validate(null);

        assertFalse(result.valid());
        assertEquals("Connection configuration cannot be null", result.message());
    }

    @Test
    @DisplayName("Should fail validation when config map is null")
    void shouldFailValidationWithNullConfigMap() {
        Connection connection = new TestConnectionView(ConnectionEntity.Type.JDBC, null);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid());
        assertEquals("Connection configuration map cannot be null", result.message());
    }

    @Test
    @DisplayName("Should fail validation when URL is not provided")
    void shouldFailValidationWithoutUrl() {
        Map<String, Object> config = new HashMap<>();
        config.put("username", "user");
        config.put("password", "pass");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.JDBC, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid());
        assertEquals("JDBC URL must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when URL is empty")
    void shouldFailValidationWithEmptyUrl() {
        Map<String, Object> config = new HashMap<>();
        config.put("url", "");
        config.put("username", "user");
        config.put("password", "pass");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.JDBC, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid());
        assertEquals("JDBC URL must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when URL is whitespace only")
    void shouldFailValidationWithWhitespaceUrl() {
        Map<String, Object> config = new HashMap<>();
        config.put("url", "   ");
        config.put("username", "user");
        config.put("password", "pass");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.JDBC, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid());
        assertEquals("JDBC URL must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation with invalid JDBC URL")
    void shouldFailValidationWithInvalidUrl() {
        Map<String, Object> config = new HashMap<>();
        config.put("url", "jdbc:postgresql://invalid-host-that-does-not-exist:5432/testdb");
        config.put("username", "user");
        config.put("password", "pass");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.JDBC, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid());
        assertThat(result.message()).containsAnyOf("Failed to connect", "Connection refused", "timeout", "UnknownHostException");
    }

    @Test
    @DisplayName("Should handle optional username and password gracefully")
    void shouldHandleOptionalCredentials() {
        Map<String, Object> config = new HashMap<>();
        config.put("url", "jdbc:postgresql://10.255.255.1:5432/testdb");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.JDBC, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid());
        assertThat(result.message()).doesNotContain("must be specified");
    }
}
