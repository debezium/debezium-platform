/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.metrics;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

import io.debezium.operator.api.model.runtime.metrics.MetricsBuilder;
import io.debezium.platform.config.PipelineConfigGroup;

/**
 * Manager for applying metrics exporter strategies.
 * This class discovers all available {@link MetricsExporterStrategy} implementations
 * via CDI and applies them based on their applicability.
 */
@ApplicationScoped
public class MetricsExporterStrategyManager {

    private final Instance<MetricsExporterStrategy> strategies;

    @Inject
    public MetricsExporterStrategyManager(Instance<MetricsExporterStrategy> strategies) {
        this.strategies = strategies;
    }

    /**
     * Builds a metrics configuration by applying all applicable exporter strategies.
     *
     * @param config the pipeline configuration
     * @return a configured MetricsBuilder
     */
    public MetricsBuilder buildMetrics(PipelineConfigGroup config) {
        var metricsBuilder = new MetricsBuilder();

        strategies.stream()
                .filter(strategy -> strategy.isApplicable(config))
                .forEach(strategy -> strategy.apply(metricsBuilder, config));

        return metricsBuilder;
    }
}
