/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

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

class PubSubConnectionValidatorTest {

    public static final int DEFAULT_TIMEOUT_SECONDS = 30;

    private PubSubConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new PubSubConnectionValidator(DEFAULT_TIMEOUT_SECONDS, PubSubConnectionValidator.DEFAULT_PUBSUB_SCOPE);
    }

    // Null / missing connection

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWhenConnectionConfigIsNull() {
        ConnectionValidationResult result = validator.validate(null);

        assertFalse(result.valid());
        assertEquals("Connection configuration cannot be null", result.message());
    }

    // project.id validation

    @Test
    @DisplayName("Should fail validation when project.id is missing")
    void shouldFailValidationWhenProjectIdIsMissing() {
        Map<String, Object> config = new HashMap<>();
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid());
        assertEquals("GCP project.id must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when project.id is null")
    void shouldFailValidationWhenProjectIdIsNull() {
        Map<String, Object> config = new HashMap<>();
        config.put("project.id", null);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid());
        assertEquals("GCP project.id must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when project.id is empty")
    void shouldFailValidationWhenProjectIdIsEmpty() {
        Map<String, Object> config = new HashMap<>();
        config.put("project.id", "");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid());
        assertEquals("GCP project.id must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when project.id is blank (whitespace only)")
    void shouldFailValidationWhenProjectIdIsBlank() {
        Map<String, Object> config = new HashMap<>();
        config.put("project.id", "   ");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid());
        assertEquals("GCP project.id must be specified", result.message());
    }

    // Config-valid scenarios that fail at the connection stage
    // (fast failures — no network TTL wait required)

    @Test
    @DisplayName("Should pass config validation but fail when inline credentials.json is malformed")
    void shouldFailWithMalformedInlineCredentialsJson() {
        Map<String, Object> config = new HashMap<>();
        config.put("project.id", "my-project");
        config.put("credentials.json", "this-is-not-valid-json");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid());
        Assertions.assertThat(result.message())
                .containsAnyOf("Failed to load credentials", "Unexpected error");
        Assertions.assertThat(result.message())
                .doesNotContain("project.id must be specified")
                .doesNotContain("Specify either");
    }

    // Optional parameters accepted

    @Test
    @DisplayName("Should accept only project.id with all optional fields absent (ADC mode)")
    void shouldAcceptProjectIdOnlyWithoutOptionalFields() {
        // Config is structurally valid. The actual connection will fail because ADC is not
        // configured in CI, but the error must come from the connection attempt — not from
        // config validation rejecting the input.
        Map<String, Object> config = new HashMap<>();
        config.put("project.id", "my-project");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        // The result may succeed or fail depending on the environment,
        // but it must not fail with a config-validation message.
        Assertions.assertThat(result.message())
                .doesNotContain("project.id must be specified")
                .doesNotContain("Specify either");
    }

    @Test
    @DisplayName("Should accept credentials.json alone")
    void shouldAcceptCredentialsJsonAlone() {
        Map<String, Object> config = new HashMap<>();
        config.put("project.id", "my-project");
        config.put("credentials.json", "{\"type\": \"service_account\"}"); // Minimal — will fail to parse as valid key
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        // Must NOT fail with a config-validation error
        Assertions.assertThat(result.message())
                .doesNotContain("project.id must be specified")
                .doesNotContain("Specify either");
    }

    @Test
    @DisplayName("Should accept optional endpoint field alongside project.id")
    void shouldAcceptEndpointField() {
        Map<String, Object> config = new HashMap<>();
        config.put("project.id", "my-project");
        config.put("endpoint", "localhost:8085");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        // Config is valid. The connection will fail because localhost:8085 is not running,
        // but the error must not be a config-validation message.
        Assertions.assertThat(result.message())
                .doesNotContain("project.id must be specified")
                .doesNotContain("Specify either");
    }

    // Named constant alignment check

    @Test
    @DisplayName("Constant PROJECT_ID_KEY must equal 'project.id'")
    void constantProjectIdKeyValue() {
        assertEquals("project.id", PubSubConnectionValidator.PROJECT_ID_KEY);
    }

    @Test
    @DisplayName("Constant CREDENTIALS_JSON_KEY must equal 'credentials.json'")
    void constantCredentialsJsonKeyValue() {
        assertEquals("credentials.json", PubSubConnectionValidator.CREDENTIALS_JSON_KEY);
    }

    @Test
    @DisplayName("Constant ENDPOINT_KEY must equal 'endpoint'")
    void constantEndpointKeyValue() {
        assertEquals("endpoint", PubSubConnectionValidator.ENDPOINT_KEY);
    }

    // Whitespace trimming in project.id

    @Test
    @DisplayName("Should trim whitespace from project.id before using it")
    void shouldTrimProjectIdWhitespace() {
        // " my-project " contains a valid ID after trimming; config validation must pass.
        // The subsequent connection attempt will fail but that is expected.
        Map<String, Object> config = new HashMap<>();
        config.put("project.id", "  my-project  ");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.GOOGLE_PUB_SUB, config);

        ConnectionValidationResult result = validator.validate(connection);

        // Must NOT produce a "project.id must be specified" error
        Assertions.assertThat(result.message())
                .doesNotContain("project.id must be specified");
    }
}
