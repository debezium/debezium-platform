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
 * Test resource for Qdrant vector database using Testcontainers WITH authentication.
 * 
 * <p>This class provides a containerized Qdrant instance WITH API key authentication 
 * enabled for integration testing. It manages the lifecycle of a Docker container running 
 * Qdrant server in authenticated mode, making it suitable for testing secure connection 
 * validation scenarios that mirror production environments.</p>
 * 
 * <p>Key features:</p>
 * <ul>
 *   <li>API key authentication required - server starts with authentication enabled</li>
 *   <li>Configurable API key for testing different authentication scenarios</li>
 *   <li>Automatic container management with proper startup and shutdown</li>
 *   <li>Port mapping and configuration injection for authenticated test scenarios</li>
 *   <li>Compatible with Quarkus test resource lifecycle</li>
 *   <li>CORS enabled for web-based testing scenarios</li>
 * </ul>
 * 
 * <p>The container is configured with environment variables to enable authentication:</p>
 * <ul>
 *   <li>{@code QDRANT__SERVICE__API_KEY} - Sets the required API key</li>
 *   <li>{@code QDRANT__SERVICE__ENABLE_CORS} - Enables CORS for web clients</li>
 * </ul>
 * 
 * <p>The default API key used is "secure-test-api-key-123" which can be accessed 
 * via {@link #getApiKey()} method. This key is only suitable for testing environments 
 * and should never be used in production.</p>
 * 
 * @author Pranav Tiwari
 * @since 1.0
 */
public class QdrantTestResourceAuthenticated implements QuarkusTestResourceLifecycleManager {

    public static final String API_KEY = "secure-test-api-key-123";

    private static final QdrantContainer QDRANT = new QdrantContainer(
            DockerImageName.parse("qdrant/qdrant:v1.7.4"))
            .withEnv("QDRANT__SERVICE__API_KEY", API_KEY)
            .withEnv("QDRANT__SERVICE__ENABLE_CORS", "true");

    public static QdrantContainer getContainer() {
        return QDRANT;
    }

    public static String getApiKey() {
        return API_KEY;
    }

    @Override
    public Map<String, String> start() {
        QDRANT.start();

        // Configure timeout and provide API key for tests
        return Map.of(
                "destinations.qdrant.connection.timeout", "30",
                "test.qdrant.auth.enabled", "true",
                "test.qdrant.api.key", API_KEY
        );
    }

    @Override
    public void stop() {
        QDRANT.stop();
    }
}