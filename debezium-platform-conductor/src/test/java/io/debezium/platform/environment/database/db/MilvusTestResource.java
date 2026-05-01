/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database.db;

import java.time.Duration;
import java.util.Map;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

/**
 * Test resource for Milvus vector database using Testcontainers.
 *
 * <p>This class provides a containerized Milvus instance WITHOUT authentication
 * for integration testing. It manages the lifecycle of a Docker container running
 * Milvus server in standalone mode, making it suitable for testing basic
 * connection validation scenarios.</p>
 *
 * <p>The Milvus instance is configured with:
 * <ul>
 *   <li>Default port 19530 mapped to a random host port</li>
 *   <li>No authentication required</li>
 *   <li>Standalone mode (single-node deployment)</li>
 * </ul>
 * </p>
 *
 */
public class MilvusTestResource implements QuarkusTestResourceLifecycleManager {

    private static final String MILVUS_IMAGE = "milvusdb/milvus:v2.6.4";
    private static final int MILVUS_GRPC_PORT = 19530;
    private static final int MILVUS_HTTP_PORT = 9091;
    private static final Duration MILVUS_STARTUP_TIMEOUT = Duration.ofMinutes(10);

    private static GenericContainer<?> milvusContainer;

    @Override
    public Map<String, String> start() {
        milvusContainer = new GenericContainer<>(DockerImageName.parse(MILVUS_IMAGE))
                .withExposedPorts(MILVUS_GRPC_PORT, MILVUS_HTTP_PORT)
                .withCommand("milvus", "run", "standalone")
                .withEnv("ETCD_USE_EMBED", "true")
                .withEnv("COMMON_STORAGETYPE", "local")
                .waitingFor(Wait.forListeningPort().withStartupTimeout(MILVUS_STARTUP_TIMEOUT));

        milvusContainer.start();

        return Map.of(
                "milvus.host", milvusContainer.getHost(),
                "milvus.grpc.port", milvusContainer.getMappedPort(MILVUS_GRPC_PORT).toString(),
                "milvus.http.port", milvusContainer.getMappedPort(MILVUS_HTTP_PORT).toString());
    }

    @Override
    public void stop() {
        if (milvusContainer != null) {
            milvusContainer.stop();
        }
    }

    public static GenericContainer<?> getContainer() {
        return milvusContainer;
    }
}
