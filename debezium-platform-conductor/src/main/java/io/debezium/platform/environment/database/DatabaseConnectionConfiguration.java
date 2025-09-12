/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database;

import java.util.HashMap;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;

import io.debezium.platform.domain.views.Connection;

public record DatabaseConnectionConfiguration(DatabaseType databaseType,
        String hostname,
        int port,
        String username,
        String password,
        @JsonAlias("dbName") String database,
        @JsonAnyGetter @JsonAnySetter Map<String, Object> additionalConfigs) {

    public static final String HOSTNAME = "hostname";
    public static final String PORT = "port";
    public static final String USERNAME = "username";
    public static final String PASSWORD = "password";
    public static final String DATABASE = "database";

    public static final String DEBEZIUM_DATABASE_USERNAME_CONFIG = "user";
    public static final String DEBEZIUM_DATABASE_NAME_CONFIG = "dbname";

    public static DatabaseConnectionConfiguration from(Connection connectionConfig) {
        Map<String, Object> config = new HashMap<>(connectionConfig.getConfig());

        String hostname = (String) config.get(HOSTNAME);
        Integer port = (Integer) config.get(PORT);
        String username = (String) config.get(USERNAME);
        String password = (String) config.get(PASSWORD);
        String database = (String) config.get(DATABASE);

        config.remove(HOSTNAME);
        config.remove(PORT);
        config.remove(USERNAME);
        config.remove(PASSWORD);
        config.remove(DATABASE);

        return new DatabaseConnectionConfiguration(DatabaseType.valueOf(connectionConfig.getType().name()),
                hostname,
                port,
                username,
                password,
                database,
                config);
    }
}
