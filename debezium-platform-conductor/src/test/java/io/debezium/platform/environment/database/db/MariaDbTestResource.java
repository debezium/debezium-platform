/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database.db;

import java.util.Map;

import org.testcontainers.containers.MariaDBContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class MariaDbTestResource implements QuarkusTestResourceLifecycleManager {

    private static final MariaDBContainer<?> MARIADB = new MariaDBContainer<>(
            DockerImageName.parse("mirror.gcr.io/mariadb:latest").asCompatibleSubstituteFor("mariadb"));

    public static MariaDBContainer<?> getContainer() {
        return MARIADB;
    }

    @Override
    public Map<String, String> start() {
        MARIADB.start();
        return Map.of(
                "quarkus.datasource.mariadb.jdbc.url", MARIADB.getJdbcUrl(),
                "quarkus.datasource.mariadb.username", MARIADB.getUsername(),
                "quarkus.datasource.mariadb.password", MARIADB.getPassword());
    }

    @Override
    public void stop() {
        MARIADB.stop();
    }
}
