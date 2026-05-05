/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;

import jakarta.inject.Inject;
import jakarta.inject.Named;

import org.junit.jupiter.api.Test;
import org.testcontainers.containers.JdbcDatabaseContainer;

import io.agroal.api.AgroalDataSource;
import io.debezium.platform.data.dto.SignalCollectionVerifyRequest;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.environment.connection.source.SourceInspector;
import io.debezium.platform.environment.database.DatabaseConnectionConfiguration;
import io.debezium.platform.environment.database.DatabaseType;
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
        ConnectionEntity.Type connectionType = ConnectionEntity.Type.POSTGRESQL;

        SignalCollectionVerifyRequest request = new SignalCollectionVerifyRequest(
                connectionConfiguration(connectionType),
                connectionType,
                "public.debezium_signal");

        assertThat(sourceInspector.verifyDataCollectionStructure(request).exists()).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE public.debezium_signal (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);");
        }

        assertThat(sourceInspector.verifyDataCollectionStructure(request).exists()).isTrue();

    }

    @Test
    void testVerifySchemaOnMySQL() throws SQLException {

        AgroalDataSource dataSource = mysqlDataSource.get();
        ConnectionEntity.Type connectionType = ConnectionEntity.Type.MYSQL;

        SignalCollectionVerifyRequest request = new SignalCollectionVerifyRequest(
                connectionConfiguration(connectionType),
                connectionType,
                "test.debezium_signal");

        assertThat(sourceInspector.verifyDataCollectionStructure(request).exists()).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE test.debezium_signal (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);");
        }

        assertThat(sourceInspector.verifyDataCollectionStructure(request).exists()).isTrue();

    }

    @Test
    void testVerifySchemaOnMariaDb() throws SQLException {

        AgroalDataSource dataSource = mariadbDataSource.get();
        ConnectionEntity.Type connectionType = ConnectionEntity.Type.MARIADB;

        SignalCollectionVerifyRequest request = new SignalCollectionVerifyRequest(
                connectionConfiguration(connectionType),
                connectionType,
                "test.debezium_signal");

        assertThat(sourceInspector.verifyDataCollectionStructure(request).exists()).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE test.debezium_signal (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);");
        }

        assertThat(sourceInspector.verifyDataCollectionStructure(request).exists()).isTrue();

    }

    @Test
    void testVerifySchemaOnOracle() throws SQLException {

        AgroalDataSource dataSource = oracleDataSource.get();
        ConnectionEntity.Type connectionType = ConnectionEntity.Type.ORACLE;

        SignalCollectionVerifyRequest request = new SignalCollectionVerifyRequest(
                connectionConfiguration(connectionType),
                connectionType,
                "DEBEZIUM.DEBEZIUM_SIGNAL");

        assertThat(sourceInspector.verifyDataCollectionStructure(request).exists()).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE DEBEZIUM.debezium_signal (id VARCHAR2(42) PRIMARY KEY, type VARCHAR2(32) NOT NULL, data VARCHAR2(2048) NULL)");
        }

        assertThat(sourceInspector.verifyDataCollectionStructure(request).exists()).isTrue();

    }

    @Test
    void testVerifySchemaOnMSSQL() throws SQLException {

        AgroalDataSource dataSource = mssqlDataSource.get();
        ConnectionEntity.Type connectionType = ConnectionEntity.Type.SQLSERVER;

        SignalCollectionVerifyRequest request = new SignalCollectionVerifyRequest(
                connectionConfiguration(connectionType),
                connectionType,
                "master.dbo.debezium_signal");

        assertThat(sourceInspector.verifyDataCollectionStructure(request).exists()).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE dbo.debezium_signal (id VARCHAR(42) PRIMARY KEY,type VARCHAR(32) NOT NULL,data VARCHAR(2048) NULL);");
        }

        assertThat(sourceInspector.verifyDataCollectionStructure(request).exists()).isTrue();

    }

    private DatabaseConnectionConfiguration connectionConfiguration(ConnectionEntity.Type connectionType) {
        DatabaseConnectionTestMetadata metadata = connectionTestMetadata(connectionType);
        JdbcDatabaseContainer<?> container = metadata.container();

        return new DatabaseConnectionConfiguration(
                metadata.databaseType(),
                container.getHost(),
                container.getMappedPort(metadata.containerPort()),
                container.getUsername(),
                container.getPassword(),
                metadata.databaseName(),
                metadata.additionalConfigs());
    }

    private DatabaseConnectionTestMetadata connectionTestMetadata(ConnectionEntity.Type connectionType) {
        return switch (connectionType) {
            case POSTGRESQL -> new DatabaseConnectionTestMetadata(
                    DatabaseType.POSTGRESQL,
                    PostgresTestResource.getContainer(),
                    5432,
                    PostgresTestResource.getContainer().getDatabaseName(),
                    Map.of());

            case MYSQL -> new DatabaseConnectionTestMetadata(
                    DatabaseType.MYSQL,
                    MySQLTestResource.getContainer(),
                    3306,
                    MySQLTestResource.getContainer().getDatabaseName(),
                    Map.of());

            case MARIADB -> new DatabaseConnectionTestMetadata(
                    DatabaseType.MARIADB,
                    MariaDbTestResource.getContainer(),
                    3306,
                    MariaDbTestResource.getContainer().getDatabaseName(),
                    Map.of());

            case ORACLE -> new DatabaseConnectionTestMetadata(
                    DatabaseType.ORACLE,
                    OracleTestResource.getContainer(),
                    1521,
                    OracleTestResource.getContainer().getDatabaseName(),
                    Map.of());

            case SQLSERVER -> new DatabaseConnectionTestMetadata(
                    DatabaseType.SQLSERVER,
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
            DatabaseType databaseType,
            JdbcDatabaseContainer<?> container,
            int containerPort,
            String databaseName,
            Map<String, Object> additionalConfigs) {
    }
}
