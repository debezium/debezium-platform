/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database.db;

import java.util.Map;

import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class MySQLTestResource implements QuarkusTestResourceLifecycleManager {

    private static final MySQLContainer<?> MYSQL = new MySQLContainer<>(
            DockerImageName.parse("quay.io/debezium/example-mysql-master:latest").asCompatibleSubstituteFor("mysql"));

    public static MySQLContainer<?> getContainer() {
        return MYSQL;
    }

    @Override
    public Map<String, String> start() {
        MYSQL.start();
        return Map.of(
                "mysql.jdbc.url", MYSQL.getJdbcUrl(),
                "mysql.username", MYSQL.getUsername(),
                "mysql.password", MYSQL.getPassword());
    }

    @Override
    public void stop() {
        MYSQL.stop();
    }
}