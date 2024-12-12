package io.debezium.platform.environment.watcher.consumers;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.EnvironmentController;
import io.debezium.platform.environment.watcher.events.EventType;
import jakarta.enterprise.context.Dependent;
import org.jboss.logging.Logger;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Dependent
public class PipelineConsumer extends AbstractEventConsumer<PipelineFlat> {

    public PipelineConsumer(Logger logger, EnvironmentController environment, ObjectMapper objectMapper) {
        super(logger, environment, objectMapper, PipelineFlat.class);
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

        payload.ifPresentOrElse(pipelines::deploy, () -> pipelines.undeploy(id));
    }
}
