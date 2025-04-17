/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions;

import java.util.Map;

import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

// Test resources for different databases
public class PostgresTestResource implements QuarkusTestResourceLifecycleManager {

    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(
            DockerImageName.parse("quay.io/debezium/postgres:16-alpine").asCompatibleSubstituteFor("postgres"));

    @Override
    public Map<String, String> start() {
        POSTGRES.start();
        return Map.of(
                "quarkus.datasource.jdbc.url", POSTGRES.getJdbcUrl(),
                "quarkus.datasource.username", POSTGRES.getUsername(),
                "quarkus.datasource.password", POSTGRES.getPassword());
    }

    @Override
    public void stop() {
        POSTGRES.stop();
    }
}
