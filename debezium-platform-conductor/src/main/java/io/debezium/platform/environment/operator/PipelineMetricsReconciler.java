/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.Instance;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.operator.api.model.runtime.metrics.Metrics;
import io.debezium.platform.config.PipelineConfigGroup;
import io.debezium.platform.environment.operator.actions.DebeziumKubernetesAdapter;
import io.quarkus.runtime.StartupEvent;

/**
 * Applies the current metrics configuration to existing DebeziumServer resources at startup.
 *
 * <p>The metrics configuration (e.g. the OTel collector endpoint) comes from the conductor's
 * environment, so a change to it restarts the conductor. Without this, existing pipelines would keep
 * the previous endpoint until their next update event.</p>
 */
@ApplicationScoped
public class PipelineMetricsReconciler {

    private static final Logger LOGGER = LoggerFactory.getLogger(PipelineMetricsReconciler.class);

    private final Instance<DebeziumKubernetesAdapter> kubernetesAdapter;
    private final Instance<Metrics> metrics;

    @ConfigProperty(name = PipelineConfigGroup.DEPLOYMENT_MODE_PROPERTY, defaultValue = "operator")
    String deploymentMode;

    public PipelineMetricsReconciler(Instance<DebeziumKubernetesAdapter> kubernetesAdapter, Instance<Metrics> metrics) {
        this.kubernetesAdapter = kubernetesAdapter;
        this.metrics = metrics;
    }

    void onStart(@Observes StartupEvent event) {
        if (!"operator".equals(deploymentMode)) {
            return;
        }
        try {
            kubernetesAdapter.get().updateMetrics(metrics.get());
        }
        catch (Exception e) {
            LOGGER.warn("Unable to update the metrics configuration of existing pipelines: {}", e.getMessage(), e);
        }
    }
}
