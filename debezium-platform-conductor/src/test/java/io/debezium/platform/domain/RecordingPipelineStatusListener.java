/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.TransactionPhase;

/**
 * Test listener that records every {@link PipelineStatusChanged} it observes. Observing with
 * {@link TransactionPhase#AFTER_SUCCESS} means a recorded event proves the corresponding status
 * write committed.
 */
@ApplicationScoped
public class RecordingPipelineStatusListener {

    private final List<PipelineStatusChanged> events = new CopyOnWriteArrayList<>();

    void onStatusChanged(@Observes(during = TransactionPhase.AFTER_SUCCESS) PipelineStatusChanged event) {
        events.add(event);
    }

    public List<PipelineStatusChanged> events() {
        return events;
    }

    public void reset() {
        events.clear();
    }
}
