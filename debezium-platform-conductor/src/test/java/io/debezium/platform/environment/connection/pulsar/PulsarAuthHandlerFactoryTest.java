/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.pulsar;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.stream.Stream;

import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.UnsatisfiedResolutionException;
import jakarta.enterprise.inject.literal.NamedLiteral;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import io.debezium.platform.environment.connection.destination.pulsar.BasicAuthHandler;
import io.debezium.platform.environment.connection.destination.pulsar.JwtAuthHandler;
import io.debezium.platform.environment.connection.destination.pulsar.NoAuthHandler;
import io.debezium.platform.environment.connection.destination.pulsar.PulsarAuthHandler;
import io.debezium.platform.environment.connection.destination.pulsar.PulsarAuthHandlerFactory;

public class PulsarAuthHandlerFactoryTest {

    private Instance<PulsarAuthHandler> mockHandlers;
    private PulsarAuthHandlerFactory factory;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        mockHandlers = mock(Instance.class);
        factory = new PulsarAuthHandlerFactory(mockHandlers);

        // Mock handlers for supported types
        setupMockHandler("BASIC", BasicAuthHandler.class);
        setupMockHandler("JWT", JwtAuthHandler.class);
        setupMockHandler("NONE", NoAuthHandler.class);
    }

    @SuppressWarnings("unchecked")
    private void setupMockHandler(String name, Class<? extends PulsarAuthHandler> handlerClass) {
        // Collection of selectable beans in Jakarta CDI
        Instance<PulsarAuthHandler> mockInstance = mock(Instance.class);
        PulsarAuthHandler mockHandler = mock(handlerClass);
        // Check if the annotation literal matches the provided name. e.g.: @Named("BASIC")
        when(mockHandlers.select(NamedLiteral.of(name))).thenReturn(mockInstance);
        when(mockInstance.get()).thenReturn(mockHandler);
    }

    static Stream<Arguments> supportedAuthTypes() {
        return Stream.of(
                Arguments.of("basic", BasicAuthHandler.class),
                Arguments.of("BASIC", BasicAuthHandler.class),
                Arguments.of("jwt", JwtAuthHandler.class),
                Arguments.of("JWT", JwtAuthHandler.class),
                Arguments.of("none", NoAuthHandler.class),
                Arguments.of("NONE", NoAuthHandler.class));
    }

    @ParameterizedTest
    @MethodSource("supportedAuthTypes")
    @DisplayName("Should return correct handler for supported auth types (case-insensitive)")
    void shouldReturnCorrectHandlerForSupportedTypes(String authType, Class<? extends PulsarAuthHandler> expectedClass) {
        PulsarAuthHandler handler = factory.getAuthHandler(authType);
        assertInstanceOf(expectedClass, handler);
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException for unsupported auth type")
    void shouldThrowForUnsupportedAuthType() {
        assertThrows(IllegalArgumentException.class, () -> factory.getAuthHandler("unsupported"),
                "Unsupported auth scheme: unsupported");
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException for null auth type")
    void shouldThrowForNullAuthType() {
        assertThrows(IllegalArgumentException.class, () -> factory.getAuthHandler(null));
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException for empty auth type")
    void shouldThrowForEmptyAuthType() {
        assertThrows(IllegalArgumentException.class, () -> factory.getAuthHandler(""));
    }

    @Test
    @DisplayName("Should throw UnsatisfiedResolutionException if no handler found for mapped name")
    @SuppressWarnings("unchecked")
    void shouldThrowIfNoHandlerFound() {
        // Mock a supported mapping but no actual handler
        when(mockHandlers.select(any())).thenReturn(mock(Instance.class));
        when(mockHandlers.select(any()).get()).thenThrow(UnsatisfiedResolutionException.class);

        assertThrows(UnsatisfiedResolutionException.class, () -> factory.getAuthHandler("basic"));
    }
}
