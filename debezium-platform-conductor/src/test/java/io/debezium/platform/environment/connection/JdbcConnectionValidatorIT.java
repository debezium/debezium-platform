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

import java.util.Map;

import jakarta.inject.Inject;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.JdbcConnectionValidator;
import io.debezium.platform.environment.database.db.PostgresTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(value = PostgresTestResource.class, restrictToAnnotatedClass = true)
class JdbcConnectionValidatorIT {

    @Inject
    JdbcConnectionValidator connectionValidator;

    @Test
    @DisplayName("Should successfully validate connection with valid JDBC configuration")
    void shouldValidateSuccessfulConnection() {
        PostgreSQLContainer<?> container = PostgresTestResource.getContainer();

        Awaitility.await()
                .atMost(TestHelper.waitTimeForContainer())
                .until(container::isRunning);

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.JDBC, Map.of(
                "url", container.getJdbcUrl(),
                "username", container.getUsername(),
                "password", container.getPassword()));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertTrue(result.valid(), "Connection validation should succeed");
    }

    @Test
    @DisplayName("Should fail validation with wrong credentials")
    void shouldFailValidationWithWrongCredentials() {
        PostgreSQLContainer<?> container = PostgresTestResource.getContainer();

        Awaitility.await()
                .atMost(TestHelper.waitTimeForContainer())
                .until(container::isRunning);

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.JDBC, Map.of(
                "url", container.getJdbcUrl(),
                "username", "wrongUser",
                "password", "wrongPassword"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertThat(result.message()).contains("Failed to connect");
    }

    @Test
    @DisplayName("Should fail validation with wrong port in URL")
    void shouldFailValidationWithWrongPort() {
        PostgreSQLContainer<?> container = PostgresTestResource.getContainer();

        Awaitility.await()
                .atMost(TestHelper.waitTimeForContainer())
                .until(container::isRunning);

        String wrongUrl = String.format("jdbc:postgresql://%s:%d/%s",
                container.getHost(), 9999, container.getDatabaseName());

        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.JDBC, Map.of(
                "url", wrongUrl,
                "username", container.getUsername(),
                "password", container.getPassword()));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertThat(result.message()).containsAnyOf("Failed to connect", "Connection refused", "timeout");
    }

    @Test
    @DisplayName("Should fail validation when URL is missing")
    void shouldFailValidationWithoutUrl() {
        Connection connectionConfig = new TestConnectionView(ConnectionEntity.Type.JDBC, Map.of(
                "username", "user",
                "password", "pass"));

        ConnectionValidationResult result = connectionValidator.validate(connectionConfig);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("JDBC URL must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWithNullConnection() {
        ConnectionValidationResult result = connectionValidator.validate(null);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection configuration cannot be null", result.message());
    }
}
