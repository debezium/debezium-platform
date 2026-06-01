/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.metrics;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.Produces;
import jakarta.inject.Inject;

import io.debezium.operator.api.model.runtime.metrics.Metrics;
import io.debezium.operator.api.model.runtime.metrics.MetricsBuilder;
import io.debezium.platform.config.PipelineConfigGroup;

@ApplicationScoped
public class MetricsProducer {

    private final Instance<MetricsExporterStrategy> strategies;
    private final PipelineConfigGroup config;

    @Inject
    public MetricsProducer(Instance<MetricsExporterStrategy> strategies, PipelineConfigGroup config) {
        this.strategies = strategies;
        this.config = config;
    }

    @Produces
    Metrics metrics() {
        var metricsBuilder = new MetricsBuilder();

        strategies.stream()
                .filter(strategy -> strategy.isApplicable(config))
                .forEach(strategy -> strategy.apply(metricsBuilder, config));

        return metricsBuilder.build();
    }
}
