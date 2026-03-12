/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import jakarta.inject.Inject;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.testcontainers.containers.JdbcDatabaseContainer;
import org.testcontainers.shaded.org.awaitility.Awaitility;

import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.actions.DatabaseTestProfile;
import io.debezium.platform.environment.connection.source.DatabaseConnectionValidator;
import io.debezium.platform.environment.database.db.MariaDbTestResource;
import io.debezium.platform.environment.database.db.MySQLTestResource;
import io.debezium.platform.environment.database.db.OracleTestResource;
import io.debezium.platform.environment.database.db.PostgresTestResource;
import io.debezium.platform.environment.database.db.SqlserverTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@TestProfile(DatabaseTestProfile.class)
@QuarkusTestResource(value = PostgresTestResource.class, restrictToAnnotatedClass = true)
@QuarkusTestResource(value = MySQLTestResource.class, restrictToAnnotatedClass = true)
@QuarkusTestResource(value = MariaDbTestResource.class, restrictToAnnotatedClass = true)
@QuarkusTestResource(value = OracleTestResource.class, restrictToAnnotatedClass = true)
@QuarkusTestResource(value = SqlserverTestResource.class, restrictToAnnotatedClass = true)
class DatabaseConnectionValidatorIT {

    @Inject
    DatabaseConnectionValidator connectionValidator;

    private static Stream<Arguments> connectionConfigs() {
        return Stream.of(
                Arguments.of(ConnectionEntity.Type.POSTGRESQL),
                Arguments.of(ConnectionEntity.Type.MYSQL),
                Arguments.of(ConnectionEntity.Type.MARIADB),
                Arguments.of(ConnectionEntity.Type.ORACLE),
                Arguments.of(ConnectionEntity.Type.SQLSERVER));
    }

    @ParameterizedTest
    @MethodSource("connectionConfigs")
    void isValidConnection(ConnectionEntity.Type type) {

        JdbcDatabaseContainer<?> container = getContainerForType(type);

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Connection connectionConfig = new TestConnectionView(type, Map.of(
                "hostname", container.getHost(),
                "port", container.getFirstMappedPort(),
                "username", container.getUsername(),
                "password", container.getPassword(),
                "encrypt", "false",
                "trustServerCertificate", "true",
                "database", type == ConnectionEntity.Type.SQLSERVER ? "master" : container.getDatabaseName()));

        assertThat(connectionValidator.validate(connectionConfig).valid()).isTrue();
    }

    @ParameterizedTest
    @MethodSource("connectionConfigs")
    void isNotValidConnection(ConnectionEntity.Type type) {

        JdbcDatabaseContainer<?> container = getContainerForType(type);

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Connection connectionConfig = new TestConnectionView(type, Map.of(
                "hostname", container.getHost(),
                "port", container.getFirstMappedPort(),
                "username", "wrongUsername",
                "password", container.getPassword(),
                "encrypt", "false",
                "trustServerCertificate", "true",
                "database", type == ConnectionEntity.Type.SQLSERVER ? "master" : container.getDatabaseName()));

        assertThat(connectionValidator.validate(connectionConfig).valid()).isFalse();
    }

    private JdbcDatabaseContainer<?> getContainerForType(ConnectionEntity.Type type) {
        return switch (type) {
            case POSTGRESQL -> PostgresTestResource.getContainer();
            case MYSQL -> MySQLTestResource.getContainer();
            case MARIADB -> MariaDbTestResource.getContainer();
            case ORACLE -> OracleTestResource.getContainer();
            case SQLSERVER -> SqlserverTestResource.getContainer();
            default -> throw new UnsupportedOperationException();
        };
    }

}
