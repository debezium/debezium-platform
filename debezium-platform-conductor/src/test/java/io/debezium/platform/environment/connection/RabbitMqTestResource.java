/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import java.util.Map;

import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class RabbitMqTestResource implements QuarkusTestResourceLifecycleManager {

    private static final RabbitMQContainer RABBIT = new RabbitMQContainer(
            DockerImageName.parse("rabbitmq:3.13-management"));

    public static RabbitMQContainer getContainer() {
        return RABBIT;
    }

    @Override
    public Map<String, String> start() {
        RABBIT.start();
        return Map.of();
    }

    @Override
    public void stop() {
        RABBIT.stop();
    }
}
