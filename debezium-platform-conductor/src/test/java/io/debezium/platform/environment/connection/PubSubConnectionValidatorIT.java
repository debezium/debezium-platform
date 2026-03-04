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
import io.debezium.platform.environment.connection.destination.PubSubConnectionValidator;
import io.debezium.platform.environment.connection.destination.PubSubTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(PubSubTestResource.class)
class PubSubConnectionValidatorIT {

    public static final int DEFAULT_TIMEOUT_SECONDS = 10;

    private PubSubConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new PubSubConnectionValidator(DEFAULT_TIMEOUT_SECONDS);
    }

    @Test
    @DisplayName("Should successfully validate connection with valid configuration against emulator")
    void shouldValidateSuccessfulConnection() {
        Map<String, Object> config = new HashMap<>();
        config.put("project.id", "test-project");
        config.put("endpoint", PubSubTestResource.getEmulatorEndpoint());
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed against emulator");
    }

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWithNullConnection() {
        ConnectionValidationResult result = validator.validate(null);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection configuration cannot be null", result.message());
    }

    @Test
    @DisplayName("Should fail validation when project.id is missing")
    void shouldFailValidationWithoutProjectId() {
        Map<String, Object> config = new HashMap<>();
        config.put("endpoint", PubSubTestResource.getEmulatorEndpoint());
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("GCP project.id must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when project.id is empty")
    void shouldFailValidationWithEmptyProjectId() {
        Map<String, Object> config = new HashMap<>();
        config.put("project.id", "");
        config.put("endpoint", PubSubTestResource.getEmulatorEndpoint());
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("GCP project.id must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when both credential modes are provided")
    void shouldFailValidationWithBothCredentialModes() {
        Map<String, Object> config = new HashMap<>();
        config.put("project.id", "test-project");
        config.put("credentials.file.path", "/path/to/key.json");
        config.put("credentials.json", "{\"type\": \"service_account\"}");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Specify either credentials.file.path or credentials.json, not both", result.message());
    }

    @Test
    @DisplayName("Should fail connection to unreachable endpoint")
    void shouldFailConnectionToUnreachableEndpoint() {
        Map<String, Object> config = new HashMap<>();
        config.put("project.id", "test-project");
        config.put("endpoint", "localhost:1");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail for unreachable endpoint");
        Assertions.assertThat(result.message())
                .doesNotContain("project.id must be specified")
                .doesNotContain("Specify either");
    }
}
