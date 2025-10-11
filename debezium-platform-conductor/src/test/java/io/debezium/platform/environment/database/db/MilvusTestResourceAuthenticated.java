/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database.db;

import java.util.Map;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

/**
 * Test resource for Milvus vector database using Testcontainers WITH authentication.
 *
 * <p>This class provides a containerized Milvus instance WITH authentication enabled
 * for integration testing. It manages the lifecycle of a Docker container running
 * Milvus server with default root user credentials.</p>
 *
 * <p>The Milvus instance is configured with:
 * <ul>
 *   <li>Default port 19530 mapped to a random host port</li>
 *   <li>Authentication enabled with root:Milvus credentials</li>
 *   <li>Standalone mode (single-node deployment)</li>
 * </ul>
 * </p>
 *
 * <p><strong>Authentication Details:</strong><br>
 * Default credentials:
 * <ul>
 *   <li>Username: root</li>
 *   <li>Password: Milvus</li>
 *   <li>Token format: root:Milvus</li>
 * </ul>
 * </p>
 *
 * @author Pranav Tiwari
 */
public class MilvusTestResourceAuthenticated implements QuarkusTestResourceLifecycleManager {

    private static final String MILVUS_IMAGE = "milvusdb/milvus:latest";
    private static final int MILVUS_PORT = 19530;
    
    public static final String DEFAULT_USERNAME = "root";
    public static final String DEFAULT_PASSWORD = "Milvus";
    public static final String DEFAULT_TOKEN = DEFAULT_USERNAME + ":" + DEFAULT_PASSWORD;

    private static GenericContainer<?> milvusContainer;

    @Override
    public Map<String, String> start() {
        milvusContainer = new GenericContainer<>(DockerImageName.parse(MILVUS_IMAGE))
                .withExposedPorts(MILVUS_PORT)
                .withCommand("milvus", "run", "standalone")
                .withEnv("ETCD_USE_EMBED", "true")
                .withEnv("COMMON_STORAGETYPE", "local")
                .withEnv("COMMON_SECURITY_AUTHORIZATIONENABLED", "true");

        milvusContainer.start();

        return Map.of(
                "milvus.host", milvusContainer.getHost(),
                "milvus.port", milvusContainer.getMappedPort(MILVUS_PORT).toString(),
                "milvus.username", DEFAULT_USERNAME,
                "milvus.password", DEFAULT_PASSWORD,
                "milvus.token", DEFAULT_TOKEN);
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

