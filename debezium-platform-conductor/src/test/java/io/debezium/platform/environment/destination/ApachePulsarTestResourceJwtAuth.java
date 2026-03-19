/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.destination;

import java.util.Map;

import org.testcontainers.pulsar.PulsarContainer;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class ApachePulsarTestResourceJwtAuth implements QuarkusTestResourceLifecycleManager {
    // Shared test JWT token - matches the token in pulsar-standalone-jwt.conf
    public static final String TEST_JWT_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.VyRprXLybrDgsWKQEN5UnuIudMJRkwB0wpVZxIWfQLs";
    // Shared test JWT token secret key - matches the secret key in pulsar-standalone-jwt.conf
    public static final String TEST_TOKEN_SECRET_KEY = "data:;base64,WaVf/RB7ZAW7pMG3rhxnL3zC2QFqyyLaKl5W6JwWdhw=";

    private static final PulsarContainer PULSAR = new PulsarContainer(DockerImageName.parse("apachepulsar/pulsar:4.1.3"))
            .withCopyFileToContainer(
                    MountableFile.forClasspathResource("pulsar-standalone-jwt.conf"),
                    "/pulsar/conf/standalone-auth.conf")
            .withCommand(
                    "bin/pulsar",
                    "standalone",
                    "--config",
                    "/pulsar/conf/standalone-auth.conf");

    public static PulsarContainer getContainer() {
        return PULSAR;
    }

    @Override
    public Map<String, String> start() {
        PULSAR.start();
        return Map.of();
    }

    @Override
    public void stop() {
        PULSAR.stop();
    }
}
