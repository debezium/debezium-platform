/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.pulsar;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.environment.connection.destination.pulsar.BasicAuthHandler;

public class BasicAuthHandlerTest {
    private BasicAuthHandler handler;

    @BeforeEach
    void setUp() {
        handler = new BasicAuthHandler();
    }

    @Test
    @DisplayName("Should validate when both username and password are provided")
    void shouldValidateWithUsernameAndPassword() {
        Map<String, Object> config = Map.of("username", "testuser", "password", "testpass");

        assertDoesNotThrow(() -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail validation when username is missing")
    void shouldFailWhenUsernameIsMissing() {
        Map<String, Object> config = Map.of("password", "testpass");

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail validation when password is missing")
    void shouldFailWhenPasswordIsMissing() {
        Map<String, Object> config = Map.of("username", "testuser");

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail validation when both username and password are missing")
    void shouldFailWhenBothAreMissing() {
        Map<String, Object> config = new HashMap<>();

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail validation when username is null")
    void shouldFailWhenUsernameIsNull() {
        Map<String, Object> config = new HashMap<>();
        config.put("username", null);
        config.put("password", "testpass");

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail validation when password is null")
    void shouldFailWhenPasswordIsNull() {
        Map<String, Object> config = new HashMap<>();
        config.put("username", "testuser");
        config.put("password", null);

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail validation when username is blank")
    void shouldFailWhenUsernameIsBlank() {
        Map<String, Object> config = Map.of("username", " ", "password", "testpass");

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail validation when password is blank")
    void shouldFailWhenPasswordIsBlank() {
        Map<String, Object> config = Map.of("username", "testuser", "password", " ");

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }
}
