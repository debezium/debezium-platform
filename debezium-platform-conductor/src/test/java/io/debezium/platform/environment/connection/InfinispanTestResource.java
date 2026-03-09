/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import java.util.Map;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class InfinispanTestResource implements QuarkusTestResourceLifecycleManager {

    private static final int HOTROD_PORT = 11222;
    private static final String INFINISPAN_IMAGE = "quay.io/infinispan/server:" + System.getProperty("tag.infinispan", "latest");

    private static final GenericContainer<?> INFINISPAN = new GenericContainer<>(
            DockerImageName.parse(INFINISPAN_IMAGE))
            .withEnv("USER", "admin")
            .withEnv("PASS", "password")
            .withExposedPorts(HOTROD_PORT);

    public static GenericContainer<?> getContainer() {
        return INFINISPAN;
    }

    @Override
    public Map<String, String> start() {
        INFINISPAN.start();
        return Map.of();
    }

    @Override
    public void stop() {
        INFINISPAN.stop();
    }
}
