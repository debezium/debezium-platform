package io.debezium.platform.environment.destination;

import java.util.Map;

import org.testcontainers.pulsar.PulsarContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class ApachePulsarTestResource implements QuarkusTestResourceLifecycleManager {
    private static final PulsarContainer PULSAR = new PulsarContainer(DockerImageName.parse("apachepulsar/pulsar:4.1.3"));

    static {
        PULSAR.withExposedPorts(8080);
    }

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
