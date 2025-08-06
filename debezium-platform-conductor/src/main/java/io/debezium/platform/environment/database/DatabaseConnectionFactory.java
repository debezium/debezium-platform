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

@ApplicationScoped
public class DatabaseConnectionFactory {

    // TODO This could be improved to cache the connection
    public Connection create(DatabaseConnectionConfiguration databaseConnectionConfiguration) {

        var jdbcUrl = buildJdbcUrl(databaseConnectionConfiguration);
        try {
            return DriverManager.getConnection(jdbcUrl, databaseConnectionConfiguration.username(), databaseConnectionConfiguration.password());
        }
        catch (SQLException e) {
            throw new RuntimeException(String.format("Unable to get connection to database %s", jdbcUrl), e);
        }
    }

    public String buildJdbcUrl(DatabaseConnectionConfiguration conf) {
        return switch (conf.databaseType()) {
            case ORACLE -> "jdbc:oracle:thin:@" + conf.hostname() + ":" + conf.port() + "/" + conf.dbName();
            case MYSQL -> "jdbc:mysql://" + conf.hostname() + ":" + conf.port() + "/" + conf.dbName();
            case MARIADB -> "jdbc:mariadb://" + conf.hostname() + ":" + conf.port() + "/" + conf.dbName();
            case SQLSERVER -> "jdbc:sqlserver://" + conf.hostname() + ":" + conf.port() + ";databaseName=" + conf.dbName();
            case POSTGRESQL -> "jdbc:postgresql://" + conf.hostname() + ":" + conf.port() + "/" + conf.dbName();
        };
    }
}
