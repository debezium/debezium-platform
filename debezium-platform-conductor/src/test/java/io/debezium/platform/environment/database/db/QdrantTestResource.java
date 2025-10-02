/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database.db;

import java.util.Map;

import org.testcontainers.qdrant.QdrantContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

/**
 * Test resource for Qdrant vector database using Testcontainers.
 * 
 * <p>This class provides a containerized Qdrant instance WITHOUT authentication 
 * for integration testing. It manages the lifecycle of a Docker container running 
 * Qdrant server in non-authenticated mode, making it suitable for testing basic 
 * connection validation scenarios.</p>
 * 
 * <p>Key features:</p>
 * <ul>
 *   <li>No authentication required - server starts without API key validation</li>
 *   <li>Automatic container management with proper startup and shutdown</li>
 *   <li>Port mapping and configuration injection for test scenarios</li>
 *   <li>Compatible with Quarkus test resource lifecycle</li>
 * </ul>
 * 
 * <p>This resource is ideal for testing connection validation logic, parameter 
 * handling, and network connectivity without the complexity of authentication 
 * setup. It uses Qdrant v1.7.4 and exposes the standard HTTP port (6333) for 
 * client connections.</p>
 * 
 * @author Pranav Tiwari
 * @since 1.0
 */
public class QdrantTestResource implements QuarkusTestResourceLifecycleManager {

    private static final QdrantContainer QDRANT = new QdrantContainer(
            DockerImageName.parse("qdrant/qdrant:v1.7.4"));

    public static QdrantContainer getContainer() {
        return QDRANT;
    }

    @Override
    public Map<String, String> start() {
        QDRANT.start();

        // Configure timeout for Qdrant connection validator
        return Map.of(
                "destinations.qdrant.connection.timeout", "30",
                "test.qdrant.auth.enabled", "false"
        );
    }

    @Override
    public void stop() {
        QDRANT.stop();
    }
}