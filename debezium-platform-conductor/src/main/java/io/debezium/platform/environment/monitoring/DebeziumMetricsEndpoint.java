/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.monitoring;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.sun.net.httpserver.HttpServer;

public class DebeziumMetricsEndpoint {

    private static final Logger LOGGER = LoggerFactory.getLogger(DebeziumMetricsEndpoint.class);

    private final HttpServer server;
    private final String pipelineName;

    private DebeziumMetricsEndpoint(HttpServer server, String pipelineName) {
        this.server = server;
        this.pipelineName = pipelineName;
    }

    public static DebeziumMetricsEndpoint start(String pipelineName) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        DebeziumMetricsEndpoint endpoint = new DebeziumMetricsEndpoint(server, pipelineName);

        server.createContext("/metrics", exchange -> {
            String metrics = endpoint.generateMetrics();
            byte[] body = metrics.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });

        server.start();
        LOGGER.info("Debezium metrics endpoint started on port {} for pipeline '{}'", endpoint.getPort(), pipelineName);
        return endpoint;
    }

    public int getPort() {
        return server.getAddress().getPort();
    }

    public void stop() {
        server.stop(0);
    }

    public static String prometheusConfig(String hostAddress, int metricsPort, String scrapeInterval) {
        return "global:\n"
                + "  scrape_interval: " + scrapeInterval + "\n"
                + "  evaluation_interval: " + scrapeInterval + "\n"
                + "scrape_configs:\n"
                + "  - job_name: 'debezium-metrics'\n"
                + "    static_configs:\n"
                + "      - targets: ['" + hostAddress + ":" + metricsPort + "']\n";
    }

    private String generateMetrics() {
        long now = System.currentTimeMillis() / 1000;
        return "# HELP debezium_event_count_total The number of change data capture events processed.\n"
                + "# TYPE debezium_event_count_total counter\n"
                + metricLine(pipelineName, "create", 1000 + now % 200)
                + metricLine(pipelineName, "update", 400 + now % 80)
                + metricLine(pipelineName, "delete", 150 + now % 40);
    }

    private static String metricLine(String pipeline, String eventType, long value) {
        return "debezium_event_count_total{service_name=\"" + pipeline + "\","
                + "debezium_connector_type=\"postgresql\","
                + "debezium_context=\"streaming\","
                + "debezium_event_type=\"" + eventType + "\"} " + value + "\n";
    }
}
