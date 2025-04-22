/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.dto;

public record SignalCollectionVerifyRequest(
        DatabaseType databaseType,
        String hostname,
        int port,
        String username,
        String password,
        String dbName,
        String fullyQualifiedTableName) {

    public enum DatabaseType {
        ORACLE,
        MYSQL,
        MARIADB,
        SQLSERVER,
        POSTGRESQL
    }
}
