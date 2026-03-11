/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import java.time.Duration;
import java.util.Map;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class QdrantTestResource implements QuarkusTestResourceLifecycleManager {

    private static final int QDRANT_PORT = 6333;

    private static final GenericContainer<?> QDRANT = new GenericContainer<>("qdrant/qdrant:v1.13.6")
            .withExposedPorts(QDRANT_PORT)
            .waitingFor(Wait.forHttp("/healthz").forStatusCode(200))
            .withStartupTimeout(Duration.ofSeconds(120));

    public static String getHost() {
        return QDRANT.getHost();
    }

    public static int getPort() {
        return QDRANT.getMappedPort(QDRANT_PORT);
    }

    @Override
    public Map<String, String> start() {
        QDRANT.start();
        return Map.of(
                "destinations.qdrant.connection.timeout", "60");
    }

    @Override
    public void stop() {
        QDRANT.stop();
    }
}
