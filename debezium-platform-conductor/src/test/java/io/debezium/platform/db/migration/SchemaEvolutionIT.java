/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.db.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.sql.SQLException;

import jakarta.inject.Inject;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
public class SchemaEvolutionIT {

    @Inject
    Flyway flyway;

    @Inject
    AgroalDataSource dataSource;

    @Test
    public void checkMigration() {

        flyway.clean();

        assertThatCode(() -> flyway.migrate()).doesNotThrowAnyException();

    }

    @Test
    public void shouldFixConnectionSequenceWhenMigratingFromVersion360() throws SQLException {
        flyway.clean();

        Flyway migrationUpToVersion360 = Flyway.configure()
                .configuration(flyway.getConfiguration())
                .target("3.6.0")
                .load();

        assertThatCode(migrationUpToVersion360::migrate).doesNotThrowAnyException();

        long existingConnectionId = 3L;

        insertExistingConnection(existingConnectionId);

        assertThatCode(() -> flyway.migrate()).doesNotThrowAnyException();

        assertThat(connectionSequenceIncrement()).isEqualTo(50L);

        assertThat(nextConnectionSequenceValue()).isGreaterThan(existingConnectionId);
    }

    private void insertExistingConnection(long id) throws SQLException {
        try (var connection = dataSource.getConnection();
                var statement = connection.prepareStatement("""
                        insert into connection (id, name, type, config)
                        values (?, ?, 'POSTGRESQL', '{}'::jsonb)
                        """)) {
            statement.setLong(1, id);
            statement.setString(2, "existing-connection-" + id);
            statement.executeUpdate();
        }
    }

    private long connectionSequenceIncrement() throws SQLException {
        try (var connection = dataSource.getConnection();
                var statement = connection.prepareStatement("""
                        select increment_by
                        from pg_sequences
                        where sequencename = 'connection_seq'
                        """);
                var resultSet = statement.executeQuery()) {
            assertThat(resultSet.next()).isTrue();
            return resultSet.getLong(1);
        }
    }

    private long nextConnectionSequenceValue() throws SQLException {
        try (var connection = dataSource.getConnection();
                var statement = connection.prepareStatement("select nextval('connection_seq')");
                var resultSet = statement.executeQuery()) {
            assertThat(resultSet.next()).isTrue();
            return resultSet.getLong(1);
        }
    }
}
