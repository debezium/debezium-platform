/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.concurrent.TimeUnit;

import jakarta.inject.Inject;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.shaded.org.awaitility.Awaitility;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.MilvusConnectionValidator;
import io.debezium.platform.environment.database.db.MilvusTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

/**
 * Integration tests for {@link MilvusConnectionValidator} without authentication.
 * <p>
 * These tests use a real Milvus container (via Testcontainers) to verify
 * connection validation against an actual Milvus instance without authentication.
 * </p>
 *
 * @author Pranav Tiwari
 */
@QuarkusTest
@QuarkusTestResource(MilvusTestResource.class)
class MilvusConnectionValidatorIT {

    @Inject
    MilvusConnectionValidator connectionValidator;

    @Test
    @DisplayName("Should successfully connect to Milvus without authentication")
    void shouldConnectWithoutAuth() {
        GenericContainer<?> container = MilvusTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        String uri = String.format("http://%s:%d",
                container.getHost(),
                container.getMappedPort(19530));

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", uri));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertTrue(result.valid(), "Connection validation should succeed");
    }

    @Test
    @DisplayName("Should successfully connect with database parameter")
    void shouldConnectWithDatabase() {
        GenericContainer<?> container = MilvusTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        String uri = String.format("http://%s:%d",
                container.getHost(),
                container.getMappedPort(19530));

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", uri,
                "database", "default"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertTrue(result.valid(), "Connection validation with database should succeed");
    }

    @Test
    @DisplayName("Should fail with invalid host")
    void shouldFailWithInvalidHost() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", "http://invalid-host-12345:19530"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertThat(result.message()).containsAnyOf("connect", "UNAVAILABLE", "unreachable", "timeout");
    }

    @Test
    @DisplayName("Should fail with invalid port")
    void shouldFailWithInvalidPort() {
        GenericContainer<?> container = MilvusTestResource.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        String uri = String.format("http://%s:%d",
                container.getHost(),
                99999); // Invalid port

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", uri));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertThat(result.message()).containsAnyOf("connect", "refused", "UNAVAILABLE");
    }

    @Test
    @DisplayName("Should handle timeout gracefully")
    void shouldHandleTimeout() {
        // Use a non-routable IP address to simulate timeout
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", "http://10.255.255.1:19530"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertThat(result.message()).containsAnyOf("timeout", "connect", "Connection timeout");
    }
}

