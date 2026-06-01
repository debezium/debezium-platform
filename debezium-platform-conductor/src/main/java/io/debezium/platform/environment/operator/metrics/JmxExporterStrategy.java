/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.metrics;

import jakarta.enterprise.context.ApplicationScoped;

import io.debezium.operator.api.model.runtime.metrics.JmxExporterBuilder;
import io.debezium.operator.api.model.runtime.metrics.MetricsBuilder;
import io.debezium.platform.config.PipelineConfigGroup;

/**
 * Strategy for configuring JMX metrics exporter.
 * JMX exporter is typically always enabled for monitoring Java applications.
 */
@ApplicationScoped
public class JmxExporterStrategy implements MetricsExporterStrategy {

    @Override
    public boolean isApplicable(PipelineConfigGroup config) {
        // JMX is always enabled by default for backward compatibility
        // Remove once the Monitor feature is completed e2e
        return true;
    }

    @Override
    public void apply(MetricsBuilder metricsBuilder, PipelineConfigGroup config) {
        metricsBuilder.withJmxExporter(
                new JmxExporterBuilder()
                        .withEnabled()
                        .build());
    }
}
