/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database;

import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DEBEZIUM_DATABASE_NAME_CONFIG;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DEBEZIUM_DATABASE_USERNAME_CONFIG;

import java.util.EnumSet;

import jakarta.enterprise.context.ApplicationScoped;

import io.debezium.connector.mariadb.jdbc.MariaDbConnection;
import io.debezium.connector.mariadb.jdbc.MariaDbConnectionConfiguration;
import io.debezium.connector.mysql.jdbc.MySqlConnection;
import io.debezium.connector.mysql.jdbc.MySqlConnectionConfiguration;
import io.debezium.connector.oracle.OracleConnection;
import io.debezium.connector.oracle.OracleConnectorConfig;
import io.debezium.connector.postgresql.PostgresConnectorConfig;
import io.debezium.connector.postgresql.connection.PostgresConnection;
import io.debezium.connector.sqlserver.SqlServerConnection;
import io.debezium.connector.sqlserver.SqlServerConnectorConfig;
import io.debezium.data.Envelope;
import io.debezium.jdbc.JdbcConfiguration;
import io.debezium.jdbc.JdbcConnection;

@ApplicationScoped
public class DatabaseConnectionFactory {

    public static final String DATABASE_CONNECTION_CONFIGURATION_PREFIX = "database.";
    public static final String DRIVER_CONNECTION_CONFIGURATION_PREFIX = "driver.";

    public DatabaseConnectionFactory() {
    }

    public JdbcConnection create(DatabaseConnectionConfiguration databaseConnectionConfiguration) {

        JdbcConfiguration.Builder jdbcConfigurationBuilder = JdbcConfiguration.create()
                .with(DATABASE_CONNECTION_CONFIGURATION_PREFIX + DEBEZIUM_DATABASE_NAME_CONFIG, databaseConnectionConfiguration.database())
                .with(DATABASE_CONNECTION_CONFIGURATION_PREFIX + DatabaseConnectionConfiguration.HOSTNAME, databaseConnectionConfiguration.hostname())
                .with(DATABASE_CONNECTION_CONFIGURATION_PREFIX + DatabaseConnectionConfiguration.PORT, databaseConnectionConfiguration.port())
                .with(DATABASE_CONNECTION_CONFIGURATION_PREFIX + DEBEZIUM_DATABASE_USERNAME_CONFIG, databaseConnectionConfiguration.username())
                .with(DATABASE_CONNECTION_CONFIGURATION_PREFIX + DatabaseConnectionConfiguration.PASSWORD, databaseConnectionConfiguration.password());

        databaseConnectionConfiguration.additionalConfigs().forEach((k, v) -> jdbcConfigurationBuilder.with(DRIVER_CONNECTION_CONFIGURATION_PREFIX + k, v));

        return switch (databaseConnectionConfiguration.databaseType()) {
            // Re-using connection from Debezium since there is some performances improvements
            // in how the tables are retrieved by different databases
            case ORACLE -> new OracleConnection(new OracleConnectorConfig(jdbcConfigurationBuilder.build()).getJdbcConfig(), true);
            case MYSQL -> new MySqlConnection(new MySqlConnectionConfiguration(jdbcConfigurationBuilder.build()), null);
            case MARIADB -> new MariaDbConnection(new MariaDbConnectionConfiguration(jdbcConfigurationBuilder.build()), null);
            case SQLSERVER ->
                new SqlServerConnection(new SqlServerConnectorConfig(jdbcConfigurationBuilder.build()), null, EnumSet.noneOf(Envelope.Operation.class), true);
            case POSTGRESQL -> new PostgresConnection(new PostgresConnectorConfig(jdbcConfigurationBuilder.build()), null, "Debezium-Platform");

        };
    }
}
