/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.metrics;

import io.debezium.operator.api.model.runtime.metrics.MetricsBuilder;
import io.debezium.platform.config.PipelineConfigGroup;

/**
 * Strategy interface for configuring different metrics exporters.
 * Implementations of this interface encapsulate the logic for determining
 * whether a specific metrics exporter should be enabled and how to configure it.
 */
public interface MetricsExporterStrategy {

    /**
     * Determines if this metrics exporter should be enabled based on the pipeline configuration.
     *
     * @param config the pipeline configuration
     * @return true if this exporter should be applied, false otherwise
     */
    boolean isApplicable(PipelineConfigGroup config);

    /**
     * Applies this exporter's configuration to the metrics builder.
     *
     * @param metricsBuilder the metrics builder to configure
     * @param config the pipeline configuration containing exporter-specific settings
     */
    void apply(MetricsBuilder metricsBuilder, PipelineConfigGroup config);
}
