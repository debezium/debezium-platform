/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.concurrent.TimeUnit;

import jakarta.inject.Inject;

import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.JdbcDatabaseContainer;

import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.source.DatabaseConnectionValidator;

/**
 * Abstract base class for database connection validator integration tests.
 * Each concrete subclass tests a specific database type with its own container.
 */
public abstract class AbstractDatabaseConnectionValidatorIT {

    @Inject
    protected DatabaseConnectionValidator connectionValidator;

    /**
     * @return The database type being tested (e.g., POSTGRESQL, MYSQL)
     */
    protected abstract ConnectionEntity.Type getDatabaseType();

    /**
     * @return The testcontainer instance for this database type
     */
    protected abstract JdbcDatabaseContainer<?> getContainer();

    /**
     * @return Additional configuration properties specific to this database type
     */
    protected Map<String, Object> getAdditionalConfig() {
        return Map.of();
    }

    @Test
    void shouldValidateValidConnection() {
        JdbcDatabaseContainer<?> container = getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Map<String, Object> config = new java.util.HashMap<>();
        config.put("hostname", container.getHost());
        config.put("port", container.getFirstMappedPort());
        config.put("username", container.getUsername());
        config.put("password", container.getPassword());
        config.put("database", getDatabaseName(container));
        config.putAll(getAdditionalConfig());

        Connection connectionConfig = new TestConnectionView(getDatabaseType(), config);

        assertThat(connectionValidator.validate(connectionConfig).valid()).isTrue();
    }

    @Test
    void shouldRejectInvalidConnection() {
        JdbcDatabaseContainer<?> container = getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Map<String, Object> config = new java.util.HashMap<>();
        config.put("hostname", container.getHost());
        config.put("port", container.getFirstMappedPort());
        config.put("username", "wrongUsername");
        config.put("password", container.getPassword());
        config.put("database", getDatabaseName(container));
        config.putAll(getAdditionalConfig());

        Connection connectionConfig = new TestConnectionView(getDatabaseType(), config);

        assertThat(connectionValidator.validate(connectionConfig).valid()).isFalse();
    }

    private String getDatabaseName(JdbcDatabaseContainer<?> container) {
        // SQL Server uses "master" database, others use container's database name
        return getDatabaseType() == ConnectionEntity.Type.SQLSERVER ? "master" : container.getDatabaseName();
    }
}
