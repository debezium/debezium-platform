/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions;

import java.util.Map;

import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class MySQLTestResource implements QuarkusTestResourceLifecycleManager {

    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>(
            DockerImageName.parse("quay.io/debezium/example-mysql-master:latest").asCompatibleSubstituteFor("mysql"));

    @Override
    public Map<String, String> start() {
        MYSQL.start();
        return Map.of(
                "quarkus.datasource.mysql.jdbc.url", MYSQL.getJdbcUrl(),
                "quarkus.datasource.mysql.username", MYSQL.getUsername(),
                "quarkus.datasource.mysql.password", MYSQL.getPassword());
    }

    @Override
    public void stop() {
        MYSQL.stop();
    }
}
