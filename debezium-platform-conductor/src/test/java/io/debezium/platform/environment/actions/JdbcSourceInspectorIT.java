/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

import jakarta.inject.Inject;
import jakarta.inject.Named;

import org.junit.jupiter.api.Test;
import org.testcontainers.containers.JdbcDatabaseContainer;

import io.agroal.api.AgroalDataSource;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.TestConnectionView;
import io.debezium.platform.environment.connection.source.SourceInspector;
import io.debezium.platform.environment.database.DatabaseConnectionConfiguration;
import io.debezium.platform.environment.database.db.MariaDbTestResource;
import io.debezium.platform.environment.database.db.MySQLTestResource;
import io.debezium.platform.environment.database.db.OracleTestResource;
import io.debezium.platform.environment.database.db.PostgresTestResource;
import io.debezium.platform.environment.database.db.SqlserverTestResource;
import io.quarkus.agroal.DataSource;
import io.quarkus.arc.InjectableInstance;
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
public class JdbcSourceInspectorIT {

    // InjectableInstance is required when multiple datasource must be active at runtime
    // see https://quarkus.io/guides/datasource#configure-multiple-datasources
    @Inject
    InjectableInstance<AgroalDataSource> postgresDataSource;

    @Inject
    @DataSource("mysql")
    InjectableInstance<AgroalDataSource> mysqlDataSource;

    @Inject
    @DataSource("mariadb")
    InjectableInstance<AgroalDataSource> mariadbDataSource;

    @Inject
    @DataSource("oracle")
    InjectableInstance<AgroalDataSource> oracleDataSource;

    @Inject
    @DataSource("mssql")
    InjectableInstance<AgroalDataSource> mssqlDataSource;

    @Inject
    @Named("JDBC_SOURCE_INSPECTOR")
    SourceInspector sourceInspector;

    @Test
    void testVerifySchemaOnPostgres() throws SQLException {

        AgroalDataSource dataSource = postgresDataSource.get();
        Connection connection = connectionConfiguration(ConnectionEntity.Type.POSTGRESQL);

        assertThat(sourceInspector.verifyDataCollectionStructure(connection, "public.debezium_signal").exists()).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE public.debezium_signal (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);");
        }

        assertThat(sourceInspector.verifyDataCollectionStructure(connection, "public.debezium_signal").exists()).isTrue();

    }

    @Test
    void testVerifySchemaOnMySQL() throws SQLException {

        AgroalDataSource dataSource = mysqlDataSource.get();
        Connection connection = connectionConfiguration(ConnectionEntity.Type.MYSQL);

        assertThat(sourceInspector.verifyDataCollectionStructure(connection, "test.debezium_signal").exists()).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE test.debezium_signal (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);");
        }

        assertThat(sourceInspector.verifyDataCollectionStructure(connection, "test.debezium_signal").exists()).isTrue();

    }

    @Test
    void testVerifySchemaOnMariaDb() throws SQLException {

        AgroalDataSource dataSource = mariadbDataSource.get();
        Connection connection = connectionConfiguration(ConnectionEntity.Type.MARIADB);

        assertThat(sourceInspector.verifyDataCollectionStructure(connection, "test.debezium_signal").exists()).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE test.debezium_signal (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);");
        }

        assertThat(sourceInspector.verifyDataCollectionStructure(connection, "test.debezium_signal").exists()).isTrue();

    }

    @Test
    void testVerifySchemaOnOracle() throws SQLException {

        AgroalDataSource dataSource = oracleDataSource.get();
        Connection connection = connectionConfiguration(ConnectionEntity.Type.ORACLE);

        assertThat(sourceInspector.verifyDataCollectionStructure(connection, "DEBEZIUM.DEBEZIUM_SIGNAL").exists()).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE DEBEZIUM.debezium_signal (id VARCHAR2(42) PRIMARY KEY, type VARCHAR2(32) NOT NULL, data VARCHAR2(2048) NULL)");
        }

        assertThat(sourceInspector.verifyDataCollectionStructure(connection, "DEBEZIUM.DEBEZIUM_SIGNAL").exists()).isTrue();

    }

    @Test
    void testVerifySchemaOnMSSQL() throws SQLException {

        AgroalDataSource dataSource = mssqlDataSource.get();
        Connection connection = connectionConfiguration(ConnectionEntity.Type.SQLSERVER);

        assertThat(sourceInspector.verifyDataCollectionStructure(connection, "master.dbo.debezium_signal").exists()).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE dbo.debezium_signal (id VARCHAR(42) PRIMARY KEY,type VARCHAR(32) NOT NULL,data VARCHAR(2048) NULL);");
        }

        assertThat(sourceInspector.verifyDataCollectionStructure(connection, "master.dbo.debezium_signal").exists()).isTrue();

    }

    private Connection connectionConfiguration(ConnectionEntity.Type connectionType) {
        DatabaseConnectionTestMetadata metadata = connectionTestMetadata(connectionType);
        JdbcDatabaseContainer<?> container = metadata.container();

        Map<String, Object> config = new HashMap<>();
        config.put(DatabaseConnectionConfiguration.HOSTNAME, container.getHost());
        config.put(DatabaseConnectionConfiguration.PORT, container.getMappedPort(metadata.containerPort()));
        config.put(DatabaseConnectionConfiguration.USERNAME, container.getUsername());
        config.put(DatabaseConnectionConfiguration.PASSWORD, container.getPassword());
        config.put(DatabaseConnectionConfiguration.DATABASE, metadata.databaseName());
        config.putAll(metadata.additionalConfigs());

        return new TestConnectionView(connectionType, config);
    }

    private DatabaseConnectionTestMetadata connectionTestMetadata(ConnectionEntity.Type connectionType) {
        return switch (connectionType) {
            case POSTGRESQL -> new DatabaseConnectionTestMetadata(
                    PostgresTestResource.getContainer(),
                    5432,
                    PostgresTestResource.getContainer().getDatabaseName(),
                    Map.of());

            case MYSQL -> new DatabaseConnectionTestMetadata(
                    MySQLTestResource.getContainer(),
                    3306,
                    MySQLTestResource.getContainer().getDatabaseName(),
                    Map.of());

            case MARIADB -> new DatabaseConnectionTestMetadata(
                    MariaDbTestResource.getContainer(),
                    3306,
                    MariaDbTestResource.getContainer().getDatabaseName(),
                    Map.of());

            case ORACLE -> new DatabaseConnectionTestMetadata(
                    OracleTestResource.getContainer(),
                    1521,
                    OracleTestResource.getContainer().getDatabaseName(),
                    Map.of());

            case SQLSERVER -> new DatabaseConnectionTestMetadata(
                    SqlserverTestResource.getContainer(),
                    1433,
                    "master",
                    Map.of(
                            "encrypt", "false",
                            "trustServerCertificate", "true"));

            default -> throw new IllegalArgumentException("Unsupported connection type: " + connectionType);
        };
    }

    private record DatabaseConnectionTestMetadata(
            JdbcDatabaseContainer<?> container,
            int containerPort,
            String databaseName,
            Map<String, Object> additionalConfigs) {
    }
}
