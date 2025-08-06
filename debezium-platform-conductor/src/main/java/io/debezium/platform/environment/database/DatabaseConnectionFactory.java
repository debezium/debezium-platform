/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

import jakarta.enterprise.context.ApplicationScoped;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
}
