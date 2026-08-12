/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.monitoring;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

import org.awaitility.Awaitility;
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
    private static final String PIPELINE_NAME = "test-pipeline";

    private GenericContainer<?> prometheus;
    private DebeziumMetricsEndpoint metricsEndpoint;

    @Override
    public Map<String, String> start() {
        try {
            metricsEndpoint = DebeziumMetricsEndpoint.start(PIPELINE_NAME);
        }
        catch (Exception e) {
            throw new RuntimeException("Failed to start metrics endpoint", e);
        }

        int metricsPort = metricsEndpoint.getPort();
        Testcontainers.exposeHostPorts(metricsPort);

        String config = DebeziumMetricsEndpoint.prometheusConfig(
                "host.testcontainers.internal", metricsPort, "1s");

        prometheus = new GenericContainer<>(DockerImageName.parse("prom/prometheus:v3.12.0"))
                .withExposedPorts(PROMETHEUS_PORT)
                .withCopyToContainer(
                        Transferable.of(config.getBytes(StandardCharsets.UTF_8)),
                        "/etc/prometheus/prometheus.yml")
                .waitingFor(Wait.forHttp("/-/ready").forPort(PROMETHEUS_PORT));

        prometheus.start();

        String prometheusUrl = "http://localhost:" + prometheus.getMappedPort(PROMETHEUS_PORT);
        LOGGER.info("Prometheus test container started at {}", prometheusUrl);

        awaitPrometheusHasScrapedData(prometheusUrl);

        return Map.of("quarkus.rest-client.prometheus-api.url", prometheusUrl);
    }

    /**
     * Blocks until Prometheus has scraped enough Debezium metrics for the monitoring panel queries to
     * return data. The {@code streaming-event-count} panel evaluates {@code rate(...[5m])}, which needs at
     * least two scraped samples before it yields any series, so a fixed sleep after container start is
     * inherently racy under CI load. Polling the same rate expression removes that race.
     */
    private static void awaitPrometheusHasScrapedData(String prometheusUrl) {
        HttpClient client = HttpClient.newHttpClient();
        String query = "rate(debezium_event_count_total{service_name=\"" + PIPELINE_NAME
                + "\",debezium_context=\"streaming\"}[5m])";
        String queryUrl = prometheusUrl + "/api/v1/query?query="
                + URLEncoder.encode(query, StandardCharsets.UTF_8);

        Awaitility.await("Prometheus to scrape and expose Debezium metrics")
                .atMost(Duration.ofSeconds(30))
                .pollInterval(Duration.ofMillis(500))
                .ignoreExceptions()
                .until(() -> {
                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(queryUrl))
                            .GET()
                            .build();
                    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                    String body = response.body();
                    return response.statusCode() == 200
                            && body.contains("\"status\":\"success\"")
                            && !body.contains("\"result\":[]");
                });

        LOGGER.info("Prometheus has scraped Debezium metrics; monitoring tests can proceed");
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
