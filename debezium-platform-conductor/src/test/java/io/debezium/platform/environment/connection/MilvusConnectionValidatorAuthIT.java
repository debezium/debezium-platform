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
import io.debezium.platform.environment.database.db.MilvusTestResourceAuthenticated;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

/**
 * Integration tests for {@link MilvusConnectionValidator} with authentication.
 * <p>
 * These tests use a real Milvus container (via Testcontainers) configured with
 * authentication to verify connection validation against an authenticated Milvus instance.
 * </p>
 *
 * @author Pranav Tiwari
 */
@QuarkusTest
@QuarkusTestResource(MilvusTestResourceAuthenticated.class)
class MilvusConnectionValidatorAuthIT {

    @Inject
    MilvusConnectionValidator connectionValidator;

    @Test
    @DisplayName("Should successfully connect with username and password")
    void shouldConnectWithUsernamePassword() {
        GenericContainer<?> container = MilvusTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        String uri = String.format("http://%s:%d",
                container.getHost(),
                container.getMappedPort(19530));

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", uri,
                "username", MilvusTestResourceAuthenticated.DEFAULT_USERNAME,
                "password", MilvusTestResourceAuthenticated.DEFAULT_PASSWORD));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertTrue(result.valid(), "Connection validation should succeed with correct credentials");
    }

    @Test
    @DisplayName("Should successfully connect with token authentication")
    void shouldConnectWithToken() {
        GenericContainer<?> container = MilvusTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        String uri = String.format("http://%s:%d",
                container.getHost(),
                container.getMappedPort(19530));

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", uri,
                "token", MilvusTestResourceAuthenticated.DEFAULT_TOKEN));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertTrue(result.valid(), "Connection validation should succeed with token");
    }

    @Test
    @DisplayName("Should successfully connect with database and authentication")
    void shouldConnectWithDatabaseAndAuth() {
        GenericContainer<?> container = MilvusTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        String uri = String.format("http://%s:%d",
                container.getHost(),
                container.getMappedPort(19530));

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", uri,
                "database", "default",
                "username", MilvusTestResourceAuthenticated.DEFAULT_USERNAME,
                "password", MilvusTestResourceAuthenticated.DEFAULT_PASSWORD));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertTrue(result.valid(), "Connection validation should succeed with database and auth");
    }

    @Test
    @DisplayName("Should fail with incorrect password")
    void shouldFailWithIncorrectPassword() {
        GenericContainer<?> container = MilvusTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        String uri = String.format("http://%s:%d",
                container.getHost(),
                container.getMappedPort(19530));

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", uri,
                "username", MilvusTestResourceAuthenticated.DEFAULT_USERNAME,
                "password", "wrong-password"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail with incorrect password");
        assertThat(result.message()).containsAnyOf("auth", "Authentication", "permission", "Unauthenticated");
    }

    @Test
    @DisplayName("Should fail with incorrect username")
    void shouldFailWithIncorrectUsername() {
        GenericContainer<?> container = MilvusTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        String uri = String.format("http://%s:%d",
                container.getHost(),
                container.getMappedPort(19530));

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", uri,
                "username", "wrong-user",
                "password", MilvusTestResourceAuthenticated.DEFAULT_PASSWORD));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail with incorrect username");
        assertThat(result.message()).containsAnyOf("auth", "Authentication", "permission", "Unauthenticated");
    }

    @Test
    @DisplayName("Should fail with incorrect token")
    void shouldFailWithIncorrectToken() {
        GenericContainer<?> container = MilvusTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        String uri = String.format("http://%s:%d",
                container.getHost(),
                container.getMappedPort(19530));

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", uri,
                "token", "wrong:token"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail with incorrect token");
        assertThat(result.message()).containsAnyOf("auth", "Authentication", "permission", "Unauthenticated");
    }

    @Test
    @DisplayName("Should fail when authentication is required but not provided")
    void shouldFailWithoutAuthWhenRequired() {
        GenericContainer<?> container = MilvusTestResourceAuthenticated.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        String uri = String.format("http://%s:%d",
                container.getHost(),
                container.getMappedPort(19530));

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", uri));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail without authentication");
        assertThat(result.message()).containsAnyOf("auth", "Authentication", "permission", "Unauthenticated");
    }
}

