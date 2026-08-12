/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import jakarta.inject.Inject;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.MilvusConnectionValidator;
import io.debezium.platform.environment.database.db.MilvusTestResourceAuthenticated;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

/**
 * Integration tests for {@link MilvusConnectionValidator} with authentication enabled.
 * <p>
 * These tests use a real Milvus container (via Testcontainers) with authorization
 * enabled to verify connection validation for username/password and token based
 * authentication, including rejection of invalid credentials.
 * </p>
 *
 */
@QuarkusTest
@QuarkusTestResource(value = MilvusTestResourceAuthenticated.class, restrictToAnnotatedClass = true)
class MilvusConnectionValidatorAuthenticatedIT {

    @BeforeAll
    static void checkDockerAvailable() {
        Assumptions.assumeTrue(
                DockerClientFactory.instance().isDockerAvailable(),
                "Docker is not available; skipping Milvus integration tests");
    }

    @Inject
    MilvusConnectionValidator connectionValidator;

    private static void awaitPortOpen(GenericContainer<?> container, int internalPort) {
        String host = container.getHost();
        int port = container.getMappedPort(internalPort);

        Awaitility.await()
                .atMost(60, TimeUnit.SECONDS)
                .pollDelay(2, TimeUnit.SECONDS)
                .pollInterval(2, TimeUnit.SECONDS)
                .ignoreExceptions()
                .until(() -> {
                    try (Socket s = new Socket()) {
                        s.connect(new InetSocketAddress(host, port), 5000);
                        return true;
                    }
                });
    }

    private static String containerUri() {
        GenericContainer<?> container = MilvusTestResourceAuthenticated.getContainer();

        awaitPortOpen(container, 19530);

        return String.format("grpc://%s:%d",
                container.getHost(),
                container.getMappedPort(19530));
    }

    @Test
    @DisplayName("Should successfully connect with username and password authentication")
    void shouldConnectWithUsernamePassword() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", containerUri(),
                "username", MilvusTestResourceAuthenticated.USERNAME,
                "password", MilvusTestResourceAuthenticated.PASSWORD));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertTrue(result.valid(), "Connection validation with username and password should succeed");
        assertThat(result.message()).doesNotContainIgnoringCase("error", "fail", "invalid", "authentication");
    }

    @Test
    @DisplayName("Should successfully connect with token authentication")
    void shouldConnectWithTokenAuth() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", containerUri(),
                "token", MilvusTestResourceAuthenticated.USERNAME + ":" + MilvusTestResourceAuthenticated.PASSWORD));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertTrue(result.valid(), "Connection validation with token authentication should succeed");
        assertThat(result.message()).doesNotContainIgnoringCase("error", "fail", "invalid", "authentication");
    }

    @Test
    @DisplayName("Should fail with invalid username and password")
    void shouldFailWithInvalidCredentials() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", containerUri(),
                "username", MilvusTestResourceAuthenticated.USERNAME,
                "password", "wrongpassword"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation with invalid credentials should fail");
        assertThat(result.message()).containsIgnoringCase("auth");
    }

    @Test
    @DisplayName("Should fail with invalid token")
    void shouldFailWithInvalidToken() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", containerUri(),
                "token", MilvusTestResourceAuthenticated.USERNAME + ":invalidtoken"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation with invalid token should fail");
        assertThat(result.message()).containsIgnoringCase("auth");
    }

    @Test
    @DisplayName("Should successfully connect with all parameters including authentication")
    void shouldConnectWithAllParams() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.MILVUS, Map.of(
                "uri", containerUri(),
                "database", "default",
                "username", MilvusTestResourceAuthenticated.USERNAME,
                "password", MilvusTestResourceAuthenticated.PASSWORD));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertTrue(result.valid(), "Connection validation with all parameters should succeed");
        assertThat(result.message()).doesNotContainIgnoringCase("error", "fail", "invalid", "authentication");
    }
}
