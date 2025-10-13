/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.util;

/**
 * Helper class for extracting database connection details from JDBC URLs in tests.
 * This is useful when working with Quarkus devservices that assign random ports to test containers.
 */
public class TestDatasourceHelper {

    private final String hostname;
    private final String port;
    private final String database;

    private TestDatasourceHelper(String hostname, String port, String database) {
        this.hostname = hostname;
        this.port = port;
        this.database = database;
    }

    /**
     * Parses a PostgreSQL JDBC URL and extracts the connection details.
     *
     * @param jdbcUrl The JDBC URL (e.g., "jdbc:postgresql://localhost:5432/dbname?param=value")
     * @return A TestDatasourceHelper instance containing the parsed details
     */
    public static TestDatasourceHelper parsePostgresJdbcUrl(String jdbcUrl) {
        // Remove the jdbc:postgresql:// prefix
        String url = jdbcUrl.replaceFirst("jdbc:postgresql://", "");

        // Split by / to separate host:port from database
        String[] parts = url.split("/");
        String hostPort = parts[0];
        String databaseWithParams = parts[1];

        // Split host and port
        String[] hostPortParts = hostPort.split(":");
        String hostname = hostPortParts[0];
        String port = hostPortParts[1];

        // Remove query parameters from database name
        String database = databaseWithParams.split("\\?")[0];

        return new TestDatasourceHelper(hostname, port, database);
    }

    /**
     * Builds a PostgreSQL JDBC URL with optional query parameters.
     *
     * @param hostname The database hostname
     * @param port     The database port
     * @param database The database name
     * @param params   Optional query parameters (e.g., "loggerLevel=OFF")
     * @return The constructed JDBC URL
     */
    public static String buildPostgresJdbcUrl(String hostname, String port, String database, String params) {
        String baseUrl = "jdbc:postgresql://" + hostname + ":" + port + "/" + database;
        if (params != null && !params.isEmpty()) {
            return baseUrl + "?" + params;
        }
        return baseUrl;
    }

    /**
     * Builds a PostgreSQL JDBC URL without query parameters.
     *
     * @param hostname The database hostname
     * @param port     The database port
     * @param database The database name
     * @return The constructed JDBC URL
     */
    public static String buildPostgresJdbcUrl(String hostname, String port, String database) {
        return buildPostgresJdbcUrl(hostname, port, database, null);
    }

    public String getHostname() {
        return hostname;
    }

    public String getPort() {
        return port;
    }

    public String getDatabase() {
        return database;
    }

    /**
     * Builds a JDBC URL from this helper's connection details.
     *
     * @param params Optional query parameters
     * @return The constructed JDBC URL
     */
    public String toJdbcUrl(String params) {
        return buildPostgresJdbcUrl(hostname, port, database, params);
    }

    /**
     * Builds a JDBC URL from this helper's connection details without query parameters.
     *
     * @return The constructed JDBC URL
     */
    public String toJdbcUrl() {
        return toJdbcUrl(null);
    }
}
