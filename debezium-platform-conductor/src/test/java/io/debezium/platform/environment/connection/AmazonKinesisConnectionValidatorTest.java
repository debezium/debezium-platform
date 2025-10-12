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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.AmazonKinesisConnectionValidator;

/**
 * Unit tests for {@link AmazonKinesisConnectionValidator}.
 * Tests configuration validation logic without actual AWS connectivity.
 *
 * @author Pranav Tiwari
 */
class AmazonKinesisConnectionValidatorTest {

    private static final int DEFAULT_TIMEOUT = 30;
    private AmazonKinesisConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new AmazonKinesisConnectionValidator(DEFAULT_TIMEOUT);
    }

    // ==================== NULL AND EMPTY CONFIGURATION TESTS ====================

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWhenConnectionConfigIsNull() {
        ConnectionValidationResult result = validator.validate(null);

        assertFalse(result.valid(), "Validation should fail for null connection config");
        assertEquals("Connection configuration cannot be null", result.message());
    }

    // ==================== REGION VALIDATION TESTS ====================

    @Test
    @DisplayName("Should fail validation when region is missing")
    void shouldFailValidationWhenRegionIsMissing() {
        Map<String, Object> config = new HashMap<>();
        config.put("stream", "test-stream");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation should fail when region is missing");
        assertEquals("Region must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when region is null")
    void shouldFailValidationWhenRegionIsNull() {
        Map<String, Object> config = new HashMap<>();
        config.put("region", null);
        config.put("stream", "test-stream");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation should fail when region is null");
        assertEquals("Region must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when region is empty string")
    void shouldFailValidationWhenRegionIsEmpty() {
        Map<String, Object> config = new HashMap<>();
        config.put("region", "");
        config.put("stream", "test-stream");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation should fail when region is empty");
        assertEquals("Region must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when region is only whitespace")
    void shouldFailValidationWhenRegionIsWhitespace() {
        Map<String, Object> config = new HashMap<>();
        config.put("region", "   ");
        config.put("stream", "test-stream");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation should fail when region is only whitespace");
        assertEquals("Region must be specified", result.message());
    }

    // ==================== STREAM NAME VALIDATION TESTS ====================

    @Test
    @DisplayName("Should fail validation when stream name is missing")
    void shouldFailValidationWhenStreamNameIsMissing() {
        Map<String, Object> config = new HashMap<>();
        config.put("region", "us-east-1");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation should fail when stream name is missing");
        assertEquals("Stream name must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when stream name is null")
    void shouldFailValidationWhenStreamNameIsNull() {
        Map<String, Object> config = new HashMap<>();
        config.put("region", "us-east-1");
        config.put("stream", null);

        Connection connection = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation should fail when stream name is null");
        assertEquals("Stream name must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when stream name is empty string")
    void shouldFailValidationWhenStreamNameIsEmpty() {
        Map<String, Object> config = new HashMap<>();
        config.put("region", "us-east-1");
        config.put("stream", "");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation should fail when stream name is empty");
        assertEquals("Stream name must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when stream name is only whitespace")
    void shouldFailValidationWhenStreamNameIsWhitespace() {
        Map<String, Object> config = new HashMap<>();
        config.put("region", "us-east-1");
        config.put("stream", "   ");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation should fail when stream name is only whitespace");
        assertEquals("Stream name must be specified", result.message());
    }

    // ==================== BOTH MISSING TESTS ====================

    @Test
    @DisplayName("Should fail validation when both region and stream are missing")
    void shouldFailValidationWhenBothRegionAndStreamAreMissing() {
        Map<String, Object> config = new HashMap<>();

        Connection connection = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation should fail when both region and stream are missing");
        // Should fail on first check (region)
        assertEquals("Region must be specified", result.message());
    }

    // ==================== OPTIONAL FIELDS TESTS ====================

    @Test
    @DisplayName("Should handle optional endpoint field when not provided")
    void shouldHandleMissingEndpoint() {
        Map<String, Object> config = new HashMap<>();
        config.put("region", "us-east-1");
        config.put("stream", "non-existent-stream");
        // endpoint is optional, not included

        Connection connection = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(connection);

        // Should use default AWS endpoint
        assertFalse(result.valid());
        // Will fail trying to connect to real AWS (no credentials in unit test)
        assertTrue(result.message().contains("Failed to validate") ||
                result.message().contains("Client error") ||
                result.message().contains("Access denied") ||
                result.message().contains("Stream not found"),
                "Should attempt connection to AWS without custom endpoint");
    }

    // ==================== EDGE CASES ====================

    @Test
    @DisplayName("Should handle very long stream name")
    void shouldHandleVeryLongStreamName() {
        Map<String, Object> config = new HashMap<>();
        config.put("region", "us-east-1");
        config.put("stream", "a".repeat(1000)); // Very long string

        Connection connection = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Should handle very long stream name gracefully");
        assertTrue(result.message().contains("Failed to validate") ||
                result.message().contains("Stream not found") ||
                result.message().contains("Client error"),
                "Should fail with appropriate error");
    }

    @Test
    @DisplayName("Should handle special characters in stream name")
    void shouldHandleSpecialCharactersInStreamName() {
        Map<String, Object> config = new HashMap<>();
        config.put("region", "us-east-1");
        config.put("stream", "test-stream-123_ABC.xyz");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Should process special characters in stream name");
        // Will fail trying to connect (no such stream), but validates the name format is handled
        assertTrue(result.message().contains("Failed to validate") ||
                result.message().contains("Stream not found") ||
                result.message().contains("Client error"),
                "Should attempt validation with special characters");
    }
}
