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
 * Test resource for Redis database using Testcontainers.
 *
 * <p>This class provides a containerized Redis instance WITHOUT authentication
 * for integration testing. It manages the lifecycle of a Docker container running
 * Redis server in non-authenticated mode, making it suitable for testing basic
 * connection validation scenarios.</p>
 *
 * <p>Key features:</p>
 * <ul>
 *   <li>No authentication required - server starts without password validation</li>
 *   <li>Automatic container management with proper startup and shutdown</li>
 *   <li>Port mapping and configuration injection for test scenarios</li>
 *   <li>Compatible with Quarkus test resource lifecycle</li>
 * </ul>
 *
 * <p>This resource is ideal for testing connection validation logic, parameter
 * handling, and network connectivity without the complexity of authentication
 * setup. It uses Redis 7-alpine and exposes the standard port (6379) for
 * client connections.</p>
 *
 * @author Pranav Kumar Tiwari
 * @since 1.0
 */
public class RedisTestResource implements QuarkusTestResourceLifecycleManager {

    private static final GenericContainer<?> REDIS = new GenericContainer<>(
            DockerImageName.parse("redis:7-alpine"));

    static {
        REDIS.withExposedPorts(6379);
    }

    public static GenericContainer<?> getContainer() {
        return REDIS;
    }

    @Override
    public Map<String, String> start() {
        REDIS.start();

        // Configure timeout for Redis connection validator
        return Map.of(
                "destinations.redis.connection.timeout", "30",
                "test.redis.auth.enabled", "false");
    }

    @Override
    public void stop() {
        REDIS.stop();
    }
}
