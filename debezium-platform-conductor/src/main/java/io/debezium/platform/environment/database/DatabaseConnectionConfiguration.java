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

// Note: This class is not a record due to incompatibility of current jackson version with
// annotated constructor params required for a record.
public class DatabaseConnectionConfiguration {

    public static final String HOSTNAME = "hostname";
    public static final String PORT = "port";
    public static final String USERNAME = "username";
    public static final String PASSWORD = "password";
    public static final String DATABASE = "database";

    public static final String DEBEZIUM_DATABASE_USERNAME_CONFIG = "user";
    public static final String DEBEZIUM_DATABASE_NAME_CONFIG = "dbname";
    private final DatabaseType databaseType;
    private final String hostname;
    private final int port;
    private final String username;
    private final String password;
    @JsonAlias("dbName")
    private final String database;
    @JsonAnyGetter
    @JsonAnySetter
    private final Map<String, Object> additionalConfigs;

    public DatabaseConnectionConfiguration(DatabaseType databaseType,
                                           String hostname,
                                           int port,
                                           String username,
                                           String password,
                                           @JsonAlias("dbName") String database,
                                           Map<String, Object> additionalConfigs) {
        this.databaseType = databaseType;
        this.hostname = hostname;
        this.port = port;
        this.username = username;
        this.password = password;
        this.database = database;
        this.additionalConfigs = additionalConfigs == null ? new HashMap<>() : additionalConfigs;
    }

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

    public DatabaseType databaseType() {
        return databaseType;
    }

    public String hostname() {
        return hostname;
    }

    public int port() {
        return port;
    }

    public String username() {
        return username;
    }

    public String password() {
        return password;
    }

    @JsonAlias("dbName")
    public String database() {
        return database;
    }

    @JsonAnyGetter
    @JsonAnySetter
    public Map<String, Object> additionalConfigs() {
        return additionalConfigs;
    }

    @Override
    public String toString() {
        return "DatabaseConnectionConfiguration[" +
                "databaseType=" + databaseType + ", " +
                "hostname=" + hostname + ", " +
                "port=" + port + ", " +
                "username=" + username + ", " +
                "password=" + password + ", " +
                "database=" + database + ", " +
                "additionalConfigs=" + additionalConfigs + ']';
    }

}
