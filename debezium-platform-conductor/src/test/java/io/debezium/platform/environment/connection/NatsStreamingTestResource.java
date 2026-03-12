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

public class NatsStreamingTestResource implements QuarkusTestResourceLifecycleManager {

    private static final int NATS_PORT = 4222;
    private static final String NATS_IMAGE = "nats-streaming:" + System.getProperty("tag.nats-streaming", "latest");

    private static final GenericContainer<?> NATS_STREAMING = new GenericContainer<>(
            DockerImageName.parse(NATS_IMAGE))
            .withCommand("-cid", "test-cluster")
            .withExposedPorts(NATS_PORT);

    public static GenericContainer<?> getContainer() {
        return NATS_STREAMING;
    }

    @Override
    public Map<String, String> start() {
        NATS_STREAMING.start();
        return Map.of();
    }

    @Override
    public void stop() {
        NATS_STREAMING.stop();
    }
}