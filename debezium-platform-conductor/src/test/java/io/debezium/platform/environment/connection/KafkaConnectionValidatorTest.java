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

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.KafkaConnectionValidator;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.kafka.InjectKafkaCompanion;
import io.quarkus.test.kafka.KafkaCompanionResource;
import io.smallrye.reactive.messaging.kafka.companion.KafkaCompanion;

@QuarkusTest
@QuarkusTestResource(KafkaCompanionResource.class)
class KafkaConnectionValidatorTest {

    public static final int DEFAULT_30_SECONDS_TIMEOUT = 30;

    @InjectKafkaCompanion
    KafkaCompanion companion;

    private KafkaConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new KafkaConnectionValidator(DEFAULT_30_SECONDS_TIMEOUT);
    }

    @Test
    @DisplayName("Should successfully validate connection with valid Kafka configuration")
    void shouldValidateSuccessfulConnection() {

        Map<String, Object> config = new HashMap<>();
        config.put("bootstrap.servers", companion.getBootstrapServers());
        Connection connection = new TestConnectionView(ConnectionEntity.Type.KAFKA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed");
    }

    @Test
    @DisplayName("Should fail validation when bootstrap servers are not provided")
    void shouldFailValidationWithoutBootstrapServers() {

        Map<String, Object> config = new HashMap<>();
        Connection connection = new TestConnectionView(ConnectionEntity.Type.KAFKA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Bootstrap servers must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when bootstrap servers are empty")
    void shouldFailValidationWithEmptyBootstrapServers() {

        Map<String, Object> config = new HashMap<>();
        config.put("bootstrap.servers", "");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.KAFKA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Bootstrap servers must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when bootstrap servers are null")
    void shouldFailValidationWithNullBootstrapServers() {

        Map<String, Object> config = new HashMap<>();
        config.put("bootstrap.servers", null);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.KAFKA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Bootstrap servers must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWithNullConnection() {

        ConnectionValidationResult result = validator.validate(null);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection configuration cannot be null", result.message());
    }

    @Test
    @DisplayName("Should fail validation with invalid bootstrap servers")
    void shouldFailValidationWithInvalidBootstrapServers() {

        Map<String, Object> config = new HashMap<>();
        config.put("bootstrap.servers", "invalid-host:9092");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.KAFKA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        Assertions.assertThat(result.message()).isEqualTo("Kafka connection error");
    }

    @Test
    @DisplayName("Should handle SASL configuration validation")
    void shouldValidateWithSaslConfiguration() {

        Map<String, Object> config = new HashMap<>();
        config.put("bootstrap.servers", companion.getBootstrapServers());
        config.put("security.protocol", "PLAINTEXT");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.KAFKA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed with security protocol");
    }

    @Test
    @DisplayName("Should handle timeout scenarios gracefully")
    void shouldHandleTimeoutScenarios() {

        Map<String, Object> config = new HashMap<>();
        config.put("bootstrap.servers", "10.255.255.1:9092"); // Non-routable IP
        Connection connection = new TestConnectionView(ConnectionEntity.Type.KAFKA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertTrue(result.message().contains("timeout") ||
                result.message().contains("Failed to connect"),
                "Error message should indicate timeout or connection failure");
    }

    @Test
    @DisplayName("Should handle multiple bootstrap servers")
    void shouldHandleMultipleBootstrapServers() {

        Map<String, Object> config = new HashMap<>();
        config.put("bootstrap.servers",
                companion.getBootstrapServers() + ",invalid-host1:9092,invalid-host2:9093");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.KAFKA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed with mixed valid/invalid servers");
    }
}
