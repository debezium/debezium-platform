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

public class PravegaTestResource implements QuarkusTestResourceLifecycleManager {
    private static final int CONTROLLER_PORT = 9090;

    private static final String PRAVEGA_VERSION = "0.13.0";
    private static final String PRAVEGA_IMAGE = "mirror.gcr.io/pravega/pravega:" + PRAVEGA_VERSION;

    private static final GenericContainer<?> PRAVEGA = new GenericContainer<>(
            DockerImageName.parse(PRAVEGA_IMAGE))
            .withCommand("standalone")
            .withExposedPorts(CONTROLLER_PORT);

    public static GenericContainer<?> getContainer() {
        return PRAVEGA;
    }

    @Override
    public Map<String, String> start() {
        PRAVEGA.start();
        return Map.of();
    }

    @Override
    public void stop() {
        PRAVEGA.stop();
    }
}
