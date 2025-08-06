/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class DatabaseJdbcUrlBuilder {

    public static final String QUERY_PARAMETER_SEPARATOR = "=";
    public static final String MS_SQLSERVER_PARAM_DELIMITER = ";";
    public static final String QUERY_PARAM_DELIMITER = "&";
    public static final String QUERY_PARAM_PREFIX = "?";

    public String buildJdbcUrl(DatabaseConnectionConfiguration conf) {
        String baseUrl = switch (conf.databaseType()) {
            case ORACLE -> "jdbc:oracle:thin:@" + conf.hostname() + ":" + conf.port() + "/" + conf.database();
            case MYSQL -> "jdbc:mysql://" + conf.hostname() + ":" + conf.port() + "/" + conf.database();
            case MARIADB -> "jdbc:mariadb://" + conf.hostname() + ":" + conf.port() + "/" + conf.database();
            case SQLSERVER -> "jdbc:sqlserver://" + conf.hostname() + ":" + conf.port() + ";databaseName=" + conf.database();
            case POSTGRESQL -> "jdbc:postgresql://" + conf.hostname() + ":" + conf.port() + "/" + conf.database();
        };

        String queryParams = buildQueryParams(conf.additionalConfigs(), conf.databaseType());
        return baseUrl + queryParams;
    }

    private String buildQueryParams(Map<String, Object> params, DatabaseType type) {

        if (params == null || params.isEmpty()) {
            return "";
        }

        return switch (type) {
            case SQLSERVER -> buildSqlServerParams(params);
            default -> buildUrlStyleParams(params);
        };
    }

    private String buildUrlStyleParams(Map<String, Object> params) {

        return params.entrySet().stream()
                .filter(e -> e.getKey() != null && e.getValue() != null)
                .map(buildParam())
                .collect(Collectors.joining(QUERY_PARAM_DELIMITER, QUERY_PARAM_PREFIX, ""));
    }

    private static Function<Map.Entry<String, Object>, String> buildParam() {
        return e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8) + QUERY_PARAMETER_SEPARATOR
                + URLEncoder.encode(e.getValue().toString(), StandardCharsets.UTF_8);
    }

    private String buildSqlServerParams(Map<String, Object> params) {

        return params.entrySet().stream()
                .filter(e -> e.getKey() != null && e.getValue() != null)
                .map(e -> MS_SQLSERVER_PARAM_DELIMITER + e.getKey() + QUERY_PARAMETER_SEPARATOR + e.getValue())
                .collect(Collectors.joining());
    }
}
