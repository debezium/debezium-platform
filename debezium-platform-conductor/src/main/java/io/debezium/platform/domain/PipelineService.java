/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.util.Optional;
import java.util.function.Consumer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.inject.Instance;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.debezium.outbox.quarkus.ExportedEvent;
import io.debezium.platform.data.model.PipelineEntity;
import io.debezium.platform.domain.views.Pipeline;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.domain.views.refs.PipelineReference;
import io.debezium.platform.environment.EnvironmentController;
import io.debezium.platform.environment.watcher.events.PipelineEvent;

@ApplicationScoped
public class PipelineService extends AbstractService<PipelineEntity, Pipeline, PipelineReference> {

    private final Event<ExportedEvent<?, ?>> event;
    private final ObjectMapper objectMapper;
    private final LogStreamingService logStreamer;
    private final Instance<EnvironmentController> environmentController;

    public PipelineService(EntityManager em,
                           CriteriaBuilderFactory cbf,
                           EntityViewManager evm,
                           Event<ExportedEvent<?, ?>> event,
                           ObjectMapper objectMapper,
                           LogStreamingService logStreamer,
                           Instance<EnvironmentController> environmentController) {
        super(PipelineEntity.class, Pipeline.class, PipelineReference.class, em, cbf, evm);
        this.event = event;
        this.objectMapper = objectMapper;
        this.logStreamer = logStreamer;
        this.environmentController = environmentController;
    }

    @Override
    @Transactional(Transactional.TxType.REQUIRED)
    public void onChange(Pipeline view) {
        var flat = findByIdAs(PipelineFlat.class, view.getId()).orElseThrow();
        event.fire(PipelineEvent.update(flat, objectMapper));
    }

    @Override
    @Transactional(Transactional.TxType.REQUIRED)
    public void onChange(Long id) {
        event.fire(PipelineEvent.delete(id));
    }

    /**
     * Returns the {@link EnvironmentController} instance for the given pipeline
     *
     * @param id pipeline id
     * @return {@link EnvironmentController} instance for the given pipeline
     */
    public Optional<EnvironmentController> environmentController(Long id) {
        return findById(id).map(pipeline -> environmentController.get());
    }

    /**
     * Streams logs for the given pipeline, invoking given consumer for each log line
     *
     * @param id       the pipeline id
     * @param consumer the consumer to invoke for each log line
     * @return log streaming task or empty optional if pipeline was not found
     */
    public Optional<LogStreamingService.LogStreamingTask> streamLogs(Long id, Consumer<String> consumer) {
        return environmentController(id)
                .map(EnvironmentController::pipelines)
                .map(pipelines -> logStreamer.stream(String.valueOf(id), () -> pipelines.logReader(id), consumer));
    }

    public Optional<String> send(Long pipelineId, Signal signal) {
        return environmentController(pipelineId)
                .map(EnvironmentController::pipelines)
                .map(pipelineController -> {
                    pipelineController.sendSignal(pipelineId, signal);

                    return signal.id();
                });
    }
}
