/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database;

import java.util.HashMap;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonAlias;

import io.debezium.platform.domain.views.Connection;

public record DatabaseConnectionConfiguration(DatabaseType databaseType,
        String hostname,
        int port,
        String username,
        String password,
        @JsonAlias("dbName") String database,
        Map<String, Object> additionalConfigs) {

    public static DatabaseConnectionConfiguration from(Connection connectionConfig) {
        Map<String, Object> config = new HashMap<>(connectionConfig.getConfig());

        String hostname = (String) config.get("hostname");
        Integer port = (Integer) config.get("port");
        String username = (String) config.get("username");
        String password = (String) config.get("password");
        String database = (String) config.get("database");

        config.remove("hostname");
        config.remove("port");
        config.remove("username");
        config.remove("password");
        config.remove("database");

        return new DatabaseConnectionConfiguration(DatabaseType.valueOf(connectionConfig.getType().name()),
                hostname,
                port,
                username,
                password,
                database,
                config);
    }
}
