/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import java.util.Map;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class RocketMqTestResource implements QuarkusTestResourceLifecycleManager {

    private static final int NAME_SERVER_PORT = 9876;

    private static final String ROCKETMQ_VERSION = "5.3.1";
    private static final String ROCKETMQ_IMAGE = "mirror.gcr.io/apache/rocketmq:" + ROCKETMQ_VERSION;

    private static final GenericContainer<?> ROCKETMQ = new GenericContainer<>(
            DockerImageName.parse(ROCKETMQ_IMAGE))
            .withCommand("sh", "mqnamesrv")
            .withExposedPorts(NAME_SERVER_PORT)
            .waitingFor(Wait.forLogMessage(".*The Name Server boot success.*", 1));

    public static GenericContainer<?> getContainer() {
        return ROCKETMQ;
    }

    public static String getNameServerAddress() {
        return ROCKETMQ.getHost() + ":" + ROCKETMQ.getMappedPort(NAME_SERVER_PORT);
    }

    @Override
    public Map<String, String> start() {
        ROCKETMQ.start();
        return Map.of();
    }

    @Override
    public void stop() {
        ROCKETMQ.stop();
    }
}
