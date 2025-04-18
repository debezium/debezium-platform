/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions;

import io.agroal.api.AgroalDataSource;
import io.debezium.platform.environment.actions.db.MariaDbTestResource;
import io.debezium.platform.environment.actions.db.MySQLTestResource;
import io.debezium.platform.environment.actions.db.OracleTestResource;
import io.debezium.platform.environment.actions.db.PostgresTestResource;
import io.debezium.platform.environment.actions.db.SqlserverTestResource;
import io.quarkus.agroal.DataSource;
import io.quarkus.arc.InjectableInstance;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.sql.SQLException;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;

@QuarkusTest
@TestProfile(DatabaseTestProfile.class)
@QuarkusTestResource(PostgresTestResource.class)
@QuarkusTestResource(MySQLTestResource.class)
@QuarkusTestResource(MariaDbTestResource.class)
@QuarkusTestResource(OracleTestResource.class)
@QuarkusTestResource(SqlserverTestResource.class)
public class SignalDataCollectionCheckerTestIT {

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

    @Test
    void testVerifySchemaOnPostgres() throws SQLException {

        AgroalDataSource dataSource = postgresDataSource.get();

        SignalDataCollectionChecker verifier = new SignalDataCollectionChecker(dataSource.getConnection());

        assertThat(verifier.verifyTableStructure("test", "debezium_signal", "public")).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE public.debezium_signal (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);");
        }
        catch (SQLException e) {
            throw new RuntimeException(e);
        }

        assertThat(verifier.verifyTableStructure("test","debezium_signal", "public")).isTrue();

    }

    @Test
    void testVerifySchemaOnMySQL() throws SQLException {

        AgroalDataSource dataSource = mysqlDataSource.get();

        SignalDataCollectionChecker verifier = new SignalDataCollectionChecker(dataSource.getConnection());

        assertThat(verifier.verifyTableStructure("test","debezium_signal", "")).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE test.debezium_signal (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);");
        }
        catch (SQLException e) {
            throw new RuntimeException(e);
        }

        assertThat(verifier.verifyTableStructure("test","debezium_signal", "")).isTrue();

    }

    @Test
    void testVerifySchemaOnMariaDb() throws SQLException {

        AgroalDataSource dataSource = mariadbDataSource.get();

        SignalDataCollectionChecker verifier = new SignalDataCollectionChecker(dataSource.getConnection());

        assertThat(verifier.verifyTableStructure("test","debezium_signal", "")).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE test.debezium_signal (id VARCHAR(42) PRIMARY KEY, type VARCHAR(32) NOT NULL, data VARCHAR(2048) NULL);");
        }
        catch (SQLException e) {
            throw new RuntimeException(e);
        }

        assertThat(verifier.verifyTableStructure("test","debezium_signal", "")).isTrue();

    }

    @Test
    void testVerifySchemaOnOracle() throws SQLException {

        AgroalDataSource dataSource = oracleDataSource.get();

        SignalDataCollectionChecker verifier = new SignalDataCollectionChecker(dataSource.getConnection());

        assertThat(verifier.verifyTableStructure(null,"DEBEZIUM_SIGNAL", "DEBEZIUM")).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE DEBEZIUM.debezium_signal (id VARCHAR2(42) PRIMARY KEY, type VARCHAR2(32) NOT NULL, data VARCHAR2(2048) NULL)");
        }
        catch (SQLException e) {
            throw new RuntimeException(e);
        }

        assertThat(verifier.verifyTableStructure(null,"DEBEZIUM_SIGNAL", "DEBEZIUM")).isTrue();

    }

    @Test
    void testVerifySchemaOnMSSQL() throws SQLException {

        AgroalDataSource dataSource = mssqlDataSource.get();

        SignalDataCollectionChecker verifier = new SignalDataCollectionChecker(dataSource.getConnection());

        assertThat(verifier.verifyTableStructure("master","debezium_signal", "dbo")).isFalse();

        try (Statement statement = dataSource.getConnection().createStatement()) {

            statement.execute("CREATE TABLE dbo.debezium_signal (id VARCHAR(42) PRIMARY KEY,type VARCHAR(32) NOT NULL,data VARCHAR(2048) NULL);");
        }
        catch (SQLException e) {
            throw new RuntimeException(e);
        }

        assertThat(verifier.verifyTableStructure("master","debezium_signal", "dbo")).isTrue();

    }
}
