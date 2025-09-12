/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.EnumSet;

import jakarta.enterprise.context.ApplicationScoped;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.connector.mariadb.jdbc.MariaDbConnection;
import io.debezium.connector.mariadb.jdbc.MariaDbConnectionConfiguration;
import io.debezium.connector.mysql.jdbc.MySqlConnection;
import io.debezium.connector.mysql.jdbc.MySqlConnectionConfiguration;
import io.debezium.connector.oracle.OracleConnection;
import io.debezium.connector.postgresql.PostgresConnectorConfig;
import io.debezium.connector.postgresql.connection.PostgresConnection;
import io.debezium.connector.sqlserver.SqlServerConnection;
import io.debezium.connector.sqlserver.SqlServerConnectorConfig;
import io.debezium.data.Envelope;
import io.debezium.jdbc.JdbcConfiguration;
import io.debezium.jdbc.JdbcConnection;

@ApplicationScoped
public class DatabaseConnectionFactory {

    private static final Logger LOGGER = LoggerFactory.getLogger(DatabaseConnectionFactory.class);

    private final DatabaseJdbcUrlBuilder databaseJdbcUrlBuilder;

    public DatabaseConnectionFactory(DatabaseJdbcUrlBuilder databaseJdbcUrlBuilder) {
        this.databaseJdbcUrlBuilder = databaseJdbcUrlBuilder;
    }

    // TODO This could be improved to cache the connection
    public Connection create(DatabaseConnectionConfiguration databaseConnectionConfiguration) throws SQLException {

        var jdbcUrl = databaseJdbcUrlBuilder.buildJdbcUrl(databaseConnectionConfiguration);
        try {
            return DriverManager.getConnection(jdbcUrl, databaseConnectionConfiguration.username(), databaseConnectionConfiguration.password());
        }
        catch (SQLException e) {

            LOGGER.error("Unable to get connection to database {}}", jdbcUrl, e);

            throw e;
        }
    }

    public JdbcConnection createDebezium(DatabaseConnectionConfiguration databaseConnectionConfiguration) {

        JdbcConfiguration.Builder jdbcConfigurationBuilder = JdbcConfiguration.create()
                .with("database." + "dbname", databaseConnectionConfiguration.database())
                .with("database." + DatabaseConnectionConfiguration.HOSTNAME, databaseConnectionConfiguration.hostname())
                .with("database." + DatabaseConnectionConfiguration.PORT, databaseConnectionConfiguration.port())
                .with("database." + "user", databaseConnectionConfiguration.username())
                .with("database." + DatabaseConnectionConfiguration.PASSWORD, databaseConnectionConfiguration.password());

        databaseConnectionConfiguration.additionalConfigs().forEach((k, v) -> jdbcConfigurationBuilder.with("driver." + k, v));

        return switch (databaseConnectionConfiguration.databaseType()) {
            case ORACLE -> new OracleConnection(jdbcConfigurationBuilder.build());
            case MYSQL -> new MySqlConnection(new MySqlConnectionConfiguration(jdbcConfigurationBuilder.build()), null);
            case MARIADB -> new MariaDbConnection(new MariaDbConnectionConfiguration(jdbcConfigurationBuilder.build()), null);
            case SQLSERVER ->
                new SqlServerConnection(new SqlServerConnectorConfig(jdbcConfigurationBuilder.build()), null, EnumSet.noneOf(Envelope.Operation.class), true);
            case POSTGRESQL -> new PostgresConnection(new PostgresConnectorConfig(jdbcConfigurationBuilder.build()), null, "Debezium-Platform");

        };
    }
}
