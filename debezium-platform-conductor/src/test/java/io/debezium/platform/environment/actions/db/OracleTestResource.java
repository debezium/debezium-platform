/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions.db;

import java.util.Map;

import org.testcontainers.containers.OracleContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class OracleTestResource implements QuarkusTestResourceLifecycleManager {

    private static final OracleContainer ORACLE = new OracleContainer(
            DockerImageName.parse("quay.io/debezium/gvenzl-oracle-xe:21-slim-faststart").asCompatibleSubstituteFor("gvenzl/oracle-xe"))
            .withUsername("debezium")
            .withPassword("dbz")
            .withDatabaseName("ORCLPDB1");

    @Override
    public Map<String, String> start() {
        ORACLE.start();
        return Map.of(
                "quarkus.datasource.oracle.jdbc.url", ORACLE.getJdbcUrl(),
                "quarkus.datasource.oracle.username", ORACLE.getUsername(),
                "quarkus.datasource.oracle.password", ORACLE.getPassword());
    }

    @Override
    public void stop() {
        ORACLE.stop();
    }
}
