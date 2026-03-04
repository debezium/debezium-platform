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

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.AzureEventHubsConnectionValidator;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(value = AzureEventHubsTestResource.class, restrictToAnnotatedClass = true)
class AzureEventHubsConnectionValidatorIT {

    private static final int DEFAULT_60_SECONDS_TIMEOUT = 60;

    /**
     * The Event Hub name configured in {@code azure_eventhubs_emulator_config.json} and created
     * by the emulator on startup.
     */
    private static final String EMULATOR_HUB_NAME = "eh1";

    private AzureEventHubsConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new AzureEventHubsConnectionValidator(DEFAULT_60_SECONDS_TIMEOUT);
    }

    /**
     * Returns the emulator's auto-generated connection string, which contains
     * valid credentials ({@code SharedAccessKeyName} and {@code SharedAccessKey})
     * and the correct endpoint for the running emulator container.
     */
    private String getValidConnectionString() {
        return AzureEventHubsTestResource.getConnectionString();
    }

    /**
     * Keeps the same endpoint and key name from a valid connection string, and
     * mutates only the shared access key to force an authentication failure.
     */
    private String withInvalidSharedAccessKey(String connectionString) {
        return connectionString
                .replaceFirst("SharedAccessKey=[^;]*", "SharedAccessKey=InvalidValue")
                .replace("UseDevelopmentEmulator=true", "UseDevelopmentEmulator=false");
    }

    @Test
    @DisplayName("Should successfully validate connection with valid Event Hubs configuration")
    void shouldValidateSuccessfulConnection() {

        Map<String, Object> config = new HashMap<>();
        config.put("connectionstring", getValidConnectionString());
        config.put("hubname", EMULATOR_HUB_NAME);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.AZURE_EVENTS_HUBS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed");
    }

    @Test
    @DisplayName("Should fail validation when connection string is not provided")
    void shouldFailValidationWithoutConnectionString() {

        Map<String, Object> config = new HashMap<>();
        config.put("hubname", EMULATOR_HUB_NAME);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.AZURE_EVENTS_HUBS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Event Hubs connection string must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when connection string is empty")
    void shouldFailValidationWithEmptyConnectionString() {

        Map<String, Object> config = new HashMap<>();
        config.put("connectionstring", "");
        config.put("hubname", EMULATOR_HUB_NAME);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.AZURE_EVENTS_HUBS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Event Hubs connection string must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when connection string is null")
    void shouldFailValidationWithNullConnectionString() {

        Map<String, Object> config = new HashMap<>();
        config.put("connectionstring", null);
        config.put("hubname", EMULATOR_HUB_NAME);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.AZURE_EVENTS_HUBS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Event Hubs connection string must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when hub name is not provided")
    void shouldFailValidationWithoutHubName() {

        Map<String, Object> config = new HashMap<>();
        config.put("connectionstring", getValidConnectionString());
        Connection connection = new TestConnectionView(ConnectionEntity.Type.AZURE_EVENTS_HUBS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Event Hub name must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when hub name is empty")
    void shouldFailValidationWithEmptyHubName() {

        Map<String, Object> config = new HashMap<>();
        config.put("connectionstring", getValidConnectionString());
        config.put("hubname", "");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.AZURE_EVENTS_HUBS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Event Hub name must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWithNullConnection() {

        ConnectionValidationResult result = validator.validate(null);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection configuration cannot be null", result.message());
    }

    @Test
    @DisplayName("Should fail validation with invalid connection string format")
    void shouldFailValidationWithInvalidConnectionString() {

        Map<String, Object> config = new HashMap<>();
        config.put("connectionstring", "not-a-valid-connection-string");
        config.put("hubname", EMULATOR_HUB_NAME);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.AZURE_EVENTS_HUBS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertThat(result.message()).containsIgnoringCase("connection string");
    }

    @Test
    @DisplayName("Should fail validation with wrong credentials in connection string")
    void shouldFailValidationWithWrongCredentials() {

        String validConnectionString = getValidConnectionString();
        String invalidConnectionString = withInvalidSharedAccessKey(validConnectionString);

        Map<String, Object> config = new HashMap<>();
        config.put("connectionstring", invalidConnectionString);
        config.put("hubname", EMULATOR_HUB_NAME);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.AZURE_EVENTS_HUBS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail with wrong credentials");
        assertThat(result.message()).containsIgnoringCase("event hubs");
    }

    @Test
    @DisplayName("Should fail validation with non-existent hub name")
    void shouldFailValidationWithNonExistentHub() {

        Map<String, Object> config = new HashMap<>();
        config.put("connectionstring", getValidConnectionString());
        config.put("hubname", "nonexistent-hub");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.AZURE_EVENTS_HUBS, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
    }
}
