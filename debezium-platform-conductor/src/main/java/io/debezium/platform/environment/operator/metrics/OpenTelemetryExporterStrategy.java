/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.metrics;

import jakarta.enterprise.context.ApplicationScoped;

import io.debezium.operator.api.model.runtime.metrics.MetricsBuilder;
import io.debezium.operator.api.model.runtime.metrics.OpenTelemetryBuilder;
import io.debezium.operator.api.model.runtime.metrics.OtelCollectorBuilder;
import io.debezium.platform.config.PipelineConfigGroup;

/**
 * Strategy for configuring OpenTelemetry metrics exporter.
 * This exporter is enabled based on configuration and can optionally
 * include a collector endpoint.
 */
@ApplicationScoped
public class OpenTelemetryExporterStrategy implements MetricsExporterStrategy {

    @Override
    public boolean isApplicable(PipelineConfigGroup config) {
        return config.monitoring().otel().enabled();
    }

    @Override
    public void apply(MetricsBuilder metricsBuilder, PipelineConfigGroup config) {
        var otelBuilder = new OpenTelemetryBuilder()
                .withEnabled();

        config.monitoring().otel().endpoint()
                .filter(e -> !e.isBlank())
                .ifPresent(endpoint -> otelBuilder.withCollector(
                        new OtelCollectorBuilder()
                                .withEndpoint(endpoint)
                                .build()));

        metricsBuilder.withOpenTelemetry(otelBuilder.build());
    }
}
