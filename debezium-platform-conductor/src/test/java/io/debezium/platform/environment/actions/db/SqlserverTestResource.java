/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions.db;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
import org.testcontainers.containers.MSSQLServerContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.Map;

public class SqlserverTestResource implements QuarkusTestResourceLifecycleManager {

    private static final MSSQLServerContainer<?> SQLSERVER = new MSSQLServerContainer<>(
            DockerImageName.parse("mcr.microsoft.com/mssql/server:2019-latest").asCompatibleSubstituteFor("mssqlserver"))
            .acceptLicense();

    @Override
    public Map<String, String> start() {
        SQLSERVER.start();
        return Map.of(
                "quarkus.datasource.mssql.jdbc.url", SQLSERVER.getJdbcUrl(),
                "quarkus.datasource.mssql.username", SQLSERVER.getUsername(),
                "quarkus.datasource.mssql.password", SQLSERVER.getPassword());
    }

    @Override
    public void stop() {
        SQLSERVER.stop();
    }
}
