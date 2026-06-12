/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.monitoring;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testcontainers.Testcontainers;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.Transferable;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class PrometheusTestResource implements QuarkusTestResourceLifecycleManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(PrometheusTestResource.class);
    private static final int PROMETHEUS_PORT = 9090;

    private GenericContainer<?> prometheus;
    private DebeziumMetricsEndpoint metricsEndpoint;

    @Override
    public Map<String, String> start() {
        try {
            metricsEndpoint = DebeziumMetricsEndpoint.start("test-pipeline");
        }
        catch (Exception e) {
            throw new RuntimeException("Failed to start metrics endpoint", e);
        }

        int metricsPort = metricsEndpoint.getPort();
        Testcontainers.exposeHostPorts(metricsPort);

        String config = DebeziumMetricsEndpoint.prometheusConfig(
                "host.testcontainers.internal", metricsPort, "1s");

        prometheus = new GenericContainer<>(DockerImageName.parse("prom/prometheus:v2.53.0"))
                .withExposedPorts(PROMETHEUS_PORT)
                .withCopyToContainer(
                        Transferable.of(config.getBytes(StandardCharsets.UTF_8)),
                        "/etc/prometheus/prometheus.yml")
                .waitingFor(Wait.forHttp("/-/ready").forPort(PROMETHEUS_PORT));

        prometheus.start();

        String prometheusUrl = "http://localhost:" + prometheus.getMappedPort(PROMETHEUS_PORT);
        LOGGER.info("Prometheus test container started at {}", prometheusUrl);

        try {
            Thread.sleep(3000);
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        return Map.of("quarkus.rest-client.prometheus-api.url", prometheusUrl);
    }

    @Override
    public void stop() {
        if (prometheus != null) {
            prometheus.stop();
        }
        if (metricsEndpoint != null) {
            metricsEndpoint.stop();
        }
    }
}
