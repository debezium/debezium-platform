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
    private static final String LABELS_FMT = "service_name=\"%s\",debezium_connector_type=\"postgresql\"";

    private final HttpServer server;
    private final String commonLabels;

    private DebeziumMetricsEndpoint(HttpServer server, String pipelineName) {
        this.server = server;
        this.commonLabels = String.format(LABELS_FMT, pipelineName);
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
        double sinWave = Math.sin(now * 0.05);
        StringBuilder sb = new StringBuilder();

        // --- Streaming event counts (counters) ---
        appendHeader(sb, "debezium_event_count_total", "counter", "The number of change data capture events processed.");
        appendCounter(sb, "debezium_event_count_total", streamingLabels("debezium_event_type=\"create\""), 5000 + now % 500);
        appendCounter(sb, "debezium_event_count_total", streamingLabels("debezium_event_type=\"update\""), 2000 + now % 200);
        appendCounter(sb, "debezium_event_count_total", streamingLabels("debezium_event_type=\"delete\""), 800 + now % 100);

        // --- Snapshot event counts (counters) ---
        appendCounter(sb, "debezium_event_count_total", snapshotLabels("debezium_event_type=\"create\""), 1200 + now % 60);
        appendCounter(sb, "debezium_event_count_total", snapshotLabels("debezium_event_type=\"update\""), 0);
        appendCounter(sb, "debezium_event_count_total", snapshotLabels("debezium_event_type=\"delete\""), 0);

        // --- Erroneous events ---
        appendHeader(sb, "debezium_event_erroneous_count_total", "counter", "The number of events that resulted in an error.");
        appendCounter(sb, "debezium_event_erroneous_count_total", streamingLabels(null), 3 + now % 2);

        // --- Filtered events ---
        appendHeader(sb, "debezium_event_filtered_count_total", "counter", "The number of events excluded by filter configuration.");
        appendCounter(sb, "debezium_event_filtered_count_total", streamingLabels(null), 150 + now % 30);

        // --- Committed transactions ---
        appendHeader(sb, "debezium_transaction_committed_count_total", "counter", "The number of committed transactions processed.");
        appendCounter(sb, "debezium_transaction_committed_count_total", streamingLabels(null), 3000 + now % 300);

        // --- Source lag (gauge, seconds) ---
        appendHeader(sb, "debezium_source_lag", "gauge", "Lag between source database and Debezium.");
        appendGauge(sb, "debezium_source_lag", streamingLabels(null), 0.5 + sinWave * 0.3 + (now % 10) * 0.02);

        // --- Time since last event (gauge, seconds) ---
        appendHeader(sb, "debezium_event_time_since_last", "gauge", "Elapsed time since the last change event.");
        appendGauge(sb, "debezium_event_time_since_last", streamingLabels(null), 0.1 + Math.abs(sinWave) * 2.0);

        // --- Connection status (gauge with state label) ---
        appendHeader(sb, "debezium_connection_status", "gauge", "Database connection status.");
        appendGauge(sb, "debezium_connection_status", streamingLabels("debezium_connection_state=\"connected\""), 1);
        appendGauge(sb, "debezium_connection_status", streamingLabels("debezium_connection_state=\"disconnected\""), 0);

        // --- Queue metrics ---
        long queueLimit = 8192;
        long queueUsed = (long) (2000 + sinWave * 1000 + now % 500);

        appendHeader(sb, "debezium_queue_limit", "gauge", "Maximum number of events the queue can hold.");
        appendGauge(sb, "debezium_queue_limit", streamingLabels(null), queueLimit);

        appendHeader(sb, "debezium_queue_remaining_capacity", "gauge", "Available slots in the event queue.");
        appendGauge(sb, "debezium_queue_remaining_capacity", streamingLabels(null), queueLimit - queueUsed);

        long queueSizeLimit = 1073741824; // 1 GB
        long queueSizeBytes = (long) (50_000_000 + sinWave * 20_000_000 + now % 5_000_000);

        appendHeader(sb, "debezium_queue_size_limit", "gauge", "Maximum size of the queue in bytes.");
        appendGauge(sb, "debezium_queue_size_limit", streamingLabels(null), queueSizeLimit);

        appendHeader(sb, "debezium_queue_size", "gauge", "Current size of the event queue in bytes.");
        appendGauge(sb, "debezium_queue_size", streamingLabels(null), queueSizeBytes);

        // --- Snapshot metrics ---
        appendHeader(sb, "debezium_snapshot_table_remaining_count", "gauge", "Tables remaining during snapshot.");
        appendGauge(sb, "debezium_snapshot_table_remaining_count", snapshotLabels(null), Math.max(0, 8 - (now % 20)));

        appendHeader(sb, "debezium_snapshot_table_count", "gauge", "Total tables in snapshot.");
        appendGauge(sb, "debezium_snapshot_table_count", snapshotLabels(null), 12);

        appendHeader(sb, "debezium_snapshot_duration", "gauge", "Elapsed snapshot time in seconds.");
        appendGauge(sb, "debezium_snapshot_duration", snapshotLabels(null), 120 + now % 60);

        // --- Snapshot state indicators ---
        appendHeader(sb, "debezium_snapshot_running", "gauge", "Whether a snapshot is running.");
        appendGauge(sb, "debezium_snapshot_running", snapshotLabels("debezium_snapshot_running_state=\"running\""), 1);
        appendGauge(sb, "debezium_snapshot_running", snapshotLabels("debezium_snapshot_running_state=\"not_running\""), 0);

        appendHeader(sb, "debezium_snapshot_completed", "gauge", "Whether the snapshot completed.");
        appendGauge(sb, "debezium_snapshot_completed", snapshotLabels("debezium_snapshot_completed_state=\"completed\""), 0);
        appendGauge(sb, "debezium_snapshot_completed", snapshotLabels("debezium_snapshot_completed_state=\"not_completed\""), 1);

        appendHeader(sb, "debezium_snapshot_aborted", "gauge", "Whether the snapshot was aborted.");
        appendGauge(sb, "debezium_snapshot_aborted", snapshotLabels("debezium_snapshot_aborted_state=\"aborted\""), 0);
        appendGauge(sb, "debezium_snapshot_aborted", snapshotLabels("debezium_snapshot_aborted_state=\"not_aborted\""), 1);

        return sb.toString();
    }

    private String streamingLabels(String extra) {
        String labels = commonLabels + ",debezium_context=\"streaming\"";
        return extra != null ? labels + "," + extra : labels;
    }

    private String snapshotLabels(String extra) {
        String labels = commonLabels + ",debezium_context=\"snapshot\"";
        return extra != null ? labels + "," + extra : labels;
    }

    private static void appendHeader(StringBuilder sb, String name, String type, String help) {
        sb.append("# HELP ").append(name).append(" ").append(help).append("\n");
        sb.append("# TYPE ").append(name).append(" ").append(type).append("\n");
    }

    private static void appendCounter(StringBuilder sb, String name, String labels, long value) {
        sb.append(name).append("{").append(labels).append("} ").append(value).append("\n");
    }

    private static void appendGauge(StringBuilder sb, String name, String labels, double value) {
        sb.append(name).append("{").append(labels).append("} ").append(String.format("%.4f", value)).append("\n");
    }

    private static void appendGauge(StringBuilder sb, String name, String labels, long value) {
        sb.append(name).append("{").append(labels).append("} ").append(value).append("\n");
    }
}
