/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;

import jakarta.inject.Inject;

import org.eclipse.microprofile.config.ConfigProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.AmazonKinesisConnectionValidator;
import io.debezium.platform.environment.database.db.AmazonKinesisTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

/**
 * Integration tests for {@link AmazonKinesisConnectionValidator}.
 * Tests the validator against a real LocalStack container running Kinesis.
 *
 * @author Pranav Tiwari
 */
@QuarkusTest
@QuarkusTestResource(AmazonKinesisTestResource.class)
public class AmazonKinesisConnectionValidatorIT {

    @Inject
    AmazonKinesisConnectionValidator validator;

    // ==================== SUCCESSFUL CONNECTION TESTS ====================

    @Test
    @DisplayName("Should successfully validate connection to existing Kinesis stream")
    void shouldConnectSuccessfully() {
        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, Map.of(
                "endpoint", ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class),
                "region", ConfigProvider.getConfig().getValue("kinesis.region", String.class),
                "stream", ConfigProvider.getConfig().getValue("kinesis.streamName", String.class)));

        ConnectionValidationResult result = validator.validate(conn);

        assertTrue(result.valid(), "Connection validation should succeed for existing stream");
    }

    @Test
    @DisplayName("Should successfully validate with trailing slash in endpoint")
    void shouldValidateWithTrailingSlashInEndpoint() {
        String endpoint = ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class);

        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, Map.of(
                "endpoint", endpoint + "/", // Add trailing slash
                "region", ConfigProvider.getConfig().getValue("kinesis.region", String.class),
                "stream", ConfigProvider.getConfig().getValue("kinesis.streamName", String.class)));

        ConnectionValidationResult result = validator.validate(conn);

        assertTrue(result.valid(), "Should handle endpoint with trailing slash");
    }

    @Test
    @DisplayName("Should successfully validate with whitespace in config values")
    void shouldValidateWithWhitespaceInConfigValues() {
        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, Map.of(
                "endpoint", ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class),
                "region", "  " + ConfigProvider.getConfig().getValue("kinesis.region", String.class) + "  ",
                "stream", "  " + ConfigProvider.getConfig().getValue("kinesis.streamName", String.class) + "  "));

        ConnectionValidationResult result = validator.validate(conn);

        assertTrue(result.valid(), "Should trim whitespace and validate successfully");
    }

    // ==================== STREAM NOT FOUND TESTS ====================

    @Test
    @DisplayName("Should fail validation when stream does not exist")
    void shouldFailForNonExistentStream() {
        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, Map.of(
                "endpoint", ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class),
                "region", ConfigProvider.getConfig().getValue("kinesis.region", String.class),
                "stream", "non-existent-stream-12345"));

        ConnectionValidationResult result = validator.validate(conn);

        assertFalse(result.valid(), "Connection validation should fail for non-existent stream");
        assertThat(result.message()).contains("Stream not found");
    }

    @Test
    @DisplayName("Should fail validation with descriptive message for non-existent stream")
    void shouldProvideDescriptiveErrorForNonExistentStream() {
        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, Map.of(
                "endpoint", ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class),
                "region", ConfigProvider.getConfig().getValue("kinesis.region", String.class),
                "stream", "another-missing-stream"));

        ConnectionValidationResult result = validator.validate(conn);

        assertFalse(result.valid());
        assertThat(result.message())
                .contains("Stream not found")
                .containsAnyOf("verify", "region");
    }

    // ==================== INVALID REGION TESTS ====================

    @Test
    @DisplayName("Should fail validation with empty region despite valid stream")
    void shouldFailWithEmptyRegion() {
        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, Map.of(
                "endpoint", ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class),
                "region", "",
                "stream", ConfigProvider.getConfig().getValue("kinesis.streamName", String.class)));

        ConnectionValidationResult result = validator.validate(conn);

        assertFalse(result.valid(), "Should fail with empty region");
        assertThat(result.message()).isEqualTo("Region must be specified");
    }

    // ==================== MISSING CONFIGURATION TESTS ====================

    @Test
    @DisplayName("Should fail validation when region is missing")
    void shouldFailWhenRegionIsMissing() {
        Map<String, Object> config = new HashMap<>();
        config.put("endpoint", ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class));
        config.put("stream", ConfigProvider.getConfig().getValue("kinesis.streamName", String.class));
        // region is missing

        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(conn);

        assertFalse(result.valid(), "Should fail when region is missing");
        assertThat(result.message()).isEqualTo("Region must be specified");
    }

    @Test
    @DisplayName("Should fail validation when stream name is missing")
    void shouldFailWhenStreamNameIsMissing() {
        Map<String, Object> config = new HashMap<>();
        config.put("endpoint", ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class));
        config.put("region", ConfigProvider.getConfig().getValue("kinesis.region", String.class));
        // stream is missing

        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(conn);

        assertFalse(result.valid(), "Should fail when stream name is missing");
        assertThat(result.message()).isEqualTo("Stream name must be specified");
    }

    @Test
    @DisplayName("Should fail validation when both region and stream are missing")
    void shouldFailWhenBothRegionAndStreamAreMissing() {
        Map<String, Object> config = new HashMap<>();
        config.put("endpoint", ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class));
        // both region and stream are missing

        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(conn);

        assertFalse(result.valid(), "Should fail when both region and stream are missing");
        // Should fail on first validation check (region)
        assertThat(result.message()).isEqualTo("Region must be specified");
    }

    // ==================== ENDPOINT TESTS ====================

    @Test
    @DisplayName("Should work without endpoint (uses default AWS)")
    void shouldWorkWithoutEndpoint() {
        Map<String, Object> config = new HashMap<>();
        config.put("region", ConfigProvider.getConfig().getValue("kinesis.region", String.class));
        config.put("stream", "non-existent-stream");
        // endpoint is not provided - will try to connect to real AWS

        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(conn);

        // Will fail because stream doesn't exist in real AWS, but proves endpoint is optional
        assertFalse(result.valid());
        // The error could be access denied or stream not found depending on credentials
        assertTrue(result.message().contains("Stream not found") ||
                result.message().contains("Access denied") ||
                result.message().contains("Client error") ||
                result.message().contains("Failed to validate"),
                "Should attempt connection to AWS without custom endpoint");
    }

    @Test
    @DisplayName("Should fail with malformed endpoint URL")
    void shouldFailWithMalformedEndpoint() {
        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, Map.of(
                "endpoint", "not-a-valid-url",
                "region", ConfigProvider.getConfig().getValue("kinesis.region", String.class),
                "stream", ConfigProvider.getConfig().getValue("kinesis.streamName", String.class)));

        ConnectionValidationResult result = validator.validate(conn);

        assertFalse(result.valid(), "Should fail with malformed endpoint");
        assertTrue(result.message().contains("Failed to validate") ||
                result.message().contains("Client error"),
                "Error message should indicate connection failure");
    }

    // ==================== OPTIONAL FIELDS TESTS ====================

    @Test
    @DisplayName("Should work without optional partitionKey field")
    void shouldWorkWithoutPartitionKey() {
        Map<String, Object> config = new HashMap<>();
        config.put("endpoint", ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class));
        config.put("region", ConfigProvider.getConfig().getValue("kinesis.region", String.class));
        config.put("stream", ConfigProvider.getConfig().getValue("kinesis.streamName", String.class));
        // partitionKey is optional and not provided

        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(conn);

        assertTrue(result.valid(), "Should work without optional partitionKey");
    }

    @Test
    @DisplayName("Should work with partitionKey provided")
    void shouldWorkWithPartitionKey() {
        Map<String, Object> config = new HashMap<>();
        config.put("endpoint", ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class));
        config.put("region", ConfigProvider.getConfig().getValue("kinesis.region", String.class));
        config.put("stream", ConfigProvider.getConfig().getValue("kinesis.streamName", String.class));
        config.put("partitionKey", "custom-partition-key");

        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, config);
        ConnectionValidationResult result = validator.validate(conn);

        assertTrue(result.valid(), "Should work with partitionKey provided");
    }

    // ==================== EDGE CASES ====================

    @Test
    @DisplayName("Should handle stream name with special characters")
    void shouldHandleStreamNameWithSpecialCharacters() {
        // Note: Kinesis stream names can contain alphanumeric, underscore, hyphen, and period
        Connection conn = new TestConnectionView(ConnectionEntity.Type.AMAZON_KINESIS, Map.of(
                "endpoint", ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class),
                "region", ConfigProvider.getConfig().getValue("kinesis.region", String.class),
                "stream", "test-stream_123.ABC"));

        ConnectionValidationResult result = validator.validate(conn);

        // Will fail because stream doesn't exist, but validates special chars are handled
        assertFalse(result.valid());
        assertThat(result.message()).contains("Stream not found");
    }

    @Test
    @DisplayName("Should handle null connection config")
    void shouldHandleNullConnectionConfig() {
        ConnectionValidationResult result = validator.validate(null);

        assertFalse(result.valid(), "Should handle null connection gracefully");
        assertThat(result.message()).isEqualTo("Connection configuration cannot be null");
    }
}
