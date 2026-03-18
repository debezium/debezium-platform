/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.pulsar;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.HashMap;
import java.util.Map;

import org.apache.pulsar.client.admin.PulsarAdminBuilder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.environment.connection.destination.pulsar.NoAuthHandler;

public class NoAuthHandlerTest {
    private NoAuthHandler handler;

    @BeforeEach
    void setUp() {
        handler = new NoAuthHandler();
    }

    @Test
    @DisplayName("Should not throw exception for empty config in validate")
    void shouldNotThrowForEmptyConfigInValidate() {
        Map<String, Object> config = new HashMap<>();

        assertDoesNotThrow(() -> handler.validate(config));
    }

    @Test
    @DisplayName("Should not throw exception for null config in validate")
    void shouldNotThrowForNullConfigInValidate() {
        assertDoesNotThrow(() -> handler.validate(null));
    }

    @Test
    @DisplayName("Should not throw exception for populated config in validate")
    void shouldNotThrowForPopulatedConfigInValidate() {
        Map<String, Object> config = Map.of("key", "value");

        assertDoesNotThrow(() -> handler.validate(config));
    }

    @Test
    @DisplayName("Should do nothing in configure")
    void shouldDoNothingInConfigure() {
        PulsarAdminBuilder builder = mock(PulsarAdminBuilder.class);
        Map<String, Object> config = new HashMap<>();

        handler.configure(builder, config);

        verifyNoInteractions(builder);
    }

    @Test
    @DisplayName("Should do nothing in configure with null config")
    void shouldDoNothingInConfigureWithNullConfig() {
        PulsarAdminBuilder builder = mock(PulsarAdminBuilder.class);

        handler.configure(builder, null);

        verifyNoInteractions(builder);
    }
}
