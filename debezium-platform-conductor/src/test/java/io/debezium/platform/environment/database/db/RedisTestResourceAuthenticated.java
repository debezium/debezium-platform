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
 * Test resource for Redis database using Testcontainers WITH authentication.
 *
 * <p>This class provides a containerized Redis instance WITH password authentication
 * enabled for integration testing. It manages the lifecycle of a Docker container running
 * Redis server in authenticated mode, making it suitable for testing secure connection
 * validation scenarios that mirror production environments.</p>
 *
 * <p>Key features:</p>
 * <ul>
 *   <li>Password authentication required - server starts with requirepass enabled</li>
 *   <li>Configurable password for testing different authentication scenarios</li>
 *   <li>Automatic container management with proper startup and shutdown</li>
 *   <li>Port mapping and configuration injection for authenticated test scenarios</li>
 *   <li>Compatible with Quarkus test resource lifecycle</li>
 *   <li>Supports both password-only auth and username+password (ACL) testing</li>
 * </ul>
 *
 * <p>The container is configured with command arguments to enable authentication:</p>
 * <ul>
 *   <li>{@code --requirepass} - Sets the required password</li>
 *   <li>ACL configuration can be added via {@code redis-server --aclfile}</li>
 * </ul>
 *
 * <p>The default password used is "test-redis-password-123" which can be accessed
 * via {@link #getPassword()} method. For username+password testing, use
 * {@link #getUsername()} which returns "testuser". These credentials are only suitable
 * for testing environments and should never be used in production.</p>
 *
 * @author Pranav Kumar Tiwari
 * @since 1.0
 */
public class RedisTestResourceAuthenticated implements QuarkusTestResourceLifecycleManager {

    public static final String PASSWORD = "test-redis-password-123";
    public static final String USERNAME = "testuser";

    private static final GenericContainer<?> REDIS = new GenericContainer<>(
            DockerImageName.parse("redis:7-alpine"))
            .withCommand("redis-server", "--requirepass", PASSWORD)
            .withExposedPorts(6379);

    public static GenericContainer<?> getContainer() {
        return REDIS;
    }

    public static String getPassword() {
        return PASSWORD;
    }

    public static String getUsername() {
        return USERNAME;
    }

    @Override
    public Map<String, String> start() {
        REDIS.start();

        // Configure timeout and provide password for tests
        return Map.of(
                "destinations.redis.connection.timeout", "30",
                "test.redis.auth.enabled", "true",
                "test.redis.password", PASSWORD,
                "test.redis.username", USERNAME);
    }

    @Override
    public void stop() {
        REDIS.stop();
    }
}

