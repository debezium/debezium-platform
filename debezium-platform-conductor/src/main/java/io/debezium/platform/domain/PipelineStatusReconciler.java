/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.environment.DebeziumServerStatusChanged;

/**
 * Bridges environment-level status signals into the domain layer.
 *
 * <p>Observes {@link DebeziumServerStatusChanged} events fired by any environment-specific
 * status watcher and delegates to {@link PipelineService#updateStatus} which persists
 * the new status and fires the domain-level {@link PipelineStatusChanged} event.</p>
 */
@ApplicationScoped
public class PipelineStatusReconciler {

    private static final Logger LOGGER = LoggerFactory.getLogger(PipelineStatusReconciler.class);

    private final PipelineService pipelineService;

    public PipelineStatusReconciler(PipelineService pipelineService) {
        this.pipelineService = pipelineService;
    }

    void onStatusChanged(@Observes DebeziumServerStatusChanged event) {
        LOGGER.debug("Reconciling pipeline {} status to {}", event.pipelineId(), event.status());
        pipelineService.updateStatus(event.pipelineId(), event.status(), event.message());
    }
}
