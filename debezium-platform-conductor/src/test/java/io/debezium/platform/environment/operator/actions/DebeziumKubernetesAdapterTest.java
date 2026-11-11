/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.actions;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.operator.api.model.DebeziumServer;
import io.debezium.operator.api.model.DebeziumServerBuilder;
import io.debezium.operator.api.model.DebeziumServerSpecBuilder;
import io.debezium.operator.api.model.runtime.RuntimeBuilder;
import io.debezium.operator.api.model.runtime.metrics.Metrics;
import io.debezium.operator.api.model.runtime.metrics.MetricsBuilder;
import io.debezium.operator.api.model.runtime.metrics.OpenTelemetryBuilder;
import io.debezium.operator.api.model.runtime.metrics.OtelCollectorBuilder;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.server.mock.EnableKubernetesMockClient;

@EnableKubernetesMockClient(crud = true)
class DebeziumKubernetesAdapterTest {

    private KubernetesClient kubernetesClient;

    @Test
    @DisplayName("Should update the metrics of DebeziumServers managed by the conductor")
    void updateMetrics() {
        create("managed", Map.of("debezium.io/conductor-id", "1"));
        create("unmanaged", Map.of());

        new DebeziumKubernetesAdapter(kubernetesClient).updateMetrics(metrics("http://alloy:4318"));

        assertThat(endpoint("managed")).isEqualTo("http://alloy:4318");
        assertThat(endpoint("unmanaged")).isEqualTo("http://old:4318");
    }

    private void create(String name, Map<String, String> labels) {
        kubernetesClient.resource(new DebeziumServerBuilder()
                .withMetadata(new ObjectMetaBuilder().withName(name).withLabels(labels).build())
                .withSpec(new DebeziumServerSpecBuilder()
                        .withRuntime(new RuntimeBuilder().withMetrics(metrics("http://old:4318")).build())
                        .build())
                .build())
                .create();
    }

    private String endpoint(String name) {
        return kubernetesClient.resources(DebeziumServer.class).withName(name).get()
                .getSpec().getRuntime().getMetrics().getOpenTelemetry().getCollector().getEndpoint();
    }

    private static Metrics metrics(String endpoint) {
        return new MetricsBuilder()
                .withOpenTelemetry(new OpenTelemetryBuilder()
                        .withEnabled()
                        .withCollector(new OtelCollectorBuilder().withEndpoint(endpoint).build())
                        .build())
                .build();
    }
}
