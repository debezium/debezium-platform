/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.watcher.consumers;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import jakarta.enterprise.context.Dependent;
import jakarta.enterprise.inject.Instance;

import org.jboss.logging.Logger;

import com.blazebit.persistence.view.EntityViewManager;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.debezium.platform.data.model.PipelineStatus;
import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.EnvironmentController;
import io.debezium.platform.environment.watcher.events.EventType;

@Dependent
public class PipelineConsumer extends AbstractEventConsumer<PipelineFlat> {

    private final PipelineService pipelineService;

    public PipelineConsumer(Logger logger, Instance<EnvironmentController> environment, ObjectMapper objectMapper, EntityViewManager evm,
                            PipelineService pipelineService) {
        super(logger, environment, objectMapper, evm, PipelineFlat.class);
        this.pipelineService = pipelineService;
    }

    @Override
    public Collection<String> consumedAggregates() {
        return List.of("pipeline");
    }

    @Override
    public Collection<String> consumedTypes() {
        return List.of(EventType.UPDATE.name(), EventType.DELETE.name());
    }

    @Override
    public void accept(Long id, Optional<PipelineFlat> payload) {
        logger.info("Received pipeline event: " + id);
        logger.info(">>> payload:  \n" + payload);
        var pipelines = environment.pipelines();

        payload.ifPresentOrElse(p -> {
            pipelineService.updateStatus(id, PipelineStatus.DEPLOYING, null);
            pipelines.deploy(p);
        }, () -> pipelines.undeploy(id));
    }

    @Override
    public void onError(String id, String aggregateType, String eventType, Exception e) {
        pipelineService.updateStatus(Long.valueOf(id), PipelineStatus.FAILED, e.getMessage());
    }
}
