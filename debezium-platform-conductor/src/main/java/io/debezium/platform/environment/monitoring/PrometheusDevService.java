/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.monitoring;

import java.io.IOException;
import java.net.ServerSocket;
import java.nio.file.Files;
import java.nio.file.Path;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.quarkus.arc.profile.IfBuildProfile;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;

@ApplicationScoped
@IfBuildProfile("dev")
public class PrometheusDevService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PrometheusDevService.class);
    private static final String CONTAINER_NAME = "debezium-platform-prometheus-dev";

    private DebeziumMetricsEndpoint metricsEndpoint;

    void onStart(@Observes StartupEvent ev) {
        try {
            if (isContainerRunning()) {
                int port = getContainerPort();
                if (port > 0) {
                    System.setProperty("quarkus.rest-client.prometheus-api.url", "http://localhost:" + port);
                }
                LOGGER.info("Prometheus dev container already running on port {}", port);
                return;
            }

            metricsEndpoint = DebeziumMetricsEndpoint.start("dev-pipeline");
            int prometheusPort = findAvailablePort();

            String config = DebeziumMetricsEndpoint.prometheusConfig(
                    "host.docker.internal", metricsEndpoint.getPort(), "2s");

            Path configFile = Files.createTempFile("prometheus-dev-", ".yml");
            Files.writeString(configFile, config);
            configFile.toFile().setReadable(true, false);
            configFile.toFile().deleteOnExit();

            startPrometheusContainer(configFile, prometheusPort);

            System.setProperty("quarkus.rest-client.prometheus-api.url", "http://localhost:" + prometheusPort);
            LOGGER.info("Prometheus dev service started at http://localhost:{}", prometheusPort);
        }
        catch (Exception e) {
            LOGGER.warn("Failed to start Prometheus dev service: {}. Monitoring API will use configured URL.", e.getMessage());
        }
    }

    void onStop(@Observes ShutdownEvent ev) {
        if (metricsEndpoint != null) {
            metricsEndpoint.stop();
        }
        stopContainer();
    }

    private int getContainerPort() {
        try {
            Process process = new ProcessBuilder("docker", "port", CONTAINER_NAME, "9090")
                    .redirectErrorStream(true)
                    .start();
            String output = new String(process.getInputStream().readAllBytes()).trim();
            if (process.waitFor() == 0 && output.contains(":")) {
                return Integer.parseInt(output.substring(output.lastIndexOf(':') + 1));
            }
        }
        catch (Exception e) {
            LOGGER.warn("Failed to get container port: {}", e.getMessage());
        }
        return -1;
    }

    private boolean isContainerRunning() {
        try {
            Process process = new ProcessBuilder("docker", "inspect", "-f", "{{.State.Running}}", CONTAINER_NAME)
                    .redirectErrorStream(true)
                    .start();
            String output = new String(process.getInputStream().readAllBytes()).trim();
            return process.waitFor() == 0 && "true".equals(output);
        }
        catch (Exception e) {
            return false;
        }
    }

    private void startPrometheusContainer(Path configFile, int hostPort) throws IOException, InterruptedException {
        exec("docker", "create",
                "--name", CONTAINER_NAME,
                "--add-host", "host.docker.internal:host-gateway",
                "-p", hostPort + ":9090",
                "prom/prometheus:v2.53.0",
                "--config.file=/etc/prometheus/prometheus.yml",
                "--storage.tsdb.retention.time=1h");

        exec("docker", "cp",
                configFile.toAbsolutePath().toString(),
                CONTAINER_NAME + ":/etc/prometheus/prometheus.yml");

        exec("docker", "start", CONTAINER_NAME);

        waitForReady(hostPort);
    }

    private void waitForReady(int port) {
        for (int i = 0; i < 30; i++) {
            java.net.HttpURLConnection conn = null;
            try {
                conn = (java.net.HttpURLConnection) new java.net.URL("http://localhost:" + port + "/-/ready").openConnection();
                conn.setConnectTimeout(1000);
                conn.setReadTimeout(1000);
                if (conn.getResponseCode() == 200) {
                    return;
                }
            }
            catch (Exception e) {
                // not ready yet
            }
            finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
            try {
                Thread.sleep(1000);
            }
            catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        LOGGER.warn("Prometheus did not become ready in 30 seconds");
    }

    private void exec(String... command) throws IOException, InterruptedException {
        Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();
        String output = new String(process.getInputStream().readAllBytes()).trim();
        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new RuntimeException("Command failed: " + String.join(" ", command) + " -> " + output);
        }
    }

    private void stopContainer() {
        try {
            new ProcessBuilder("docker", "rm", "-f", CONTAINER_NAME)
                    .redirectErrorStream(true)
                    .start()
                    .waitFor();
        }
        catch (Exception e) {
            LOGGER.warn("Failed to stop Prometheus container: {}", e.getMessage());
        }
    }

    private int findAvailablePort() throws IOException {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        }
    }
}
