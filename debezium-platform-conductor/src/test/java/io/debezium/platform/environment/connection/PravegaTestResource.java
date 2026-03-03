package io.debezium.platform.environment.connection;

import java.util.Map;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class PravegaTestResource implements QuarkusTestResourceLifecycleManager {
    private static final int CONTROLLER_PORT = 9090;

    private static final GenericContainer<?> PRAVEGA = new GenericContainer<>(
            DockerImageName.parse("pravega/pravega:0.13.0"))
            .withCommand("standalone")
            .withExposedPorts(CONTROLLER_PORT);

    public static GenericContainer<?> getContainer() {
        return PRAVEGA;
    }

    @Override
    public Map<String, String> start() {
        PRAVEGA.start();
        return Map.of();
    }

    @Override
    public void stop() {
        PRAVEGA.stop();
    }
}
