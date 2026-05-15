package io.debezium.platform.environment.operator;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.debezium.outbox.quarkus.ExportedEvent;
import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.watcher.config.WatcherConfigGroup;
import io.debezium.platform.environment.watcher.events.PipelineEvent;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.quarkus.arc.profile.IfBuildProfile;
import io.quarkus.runtime.Startup;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.net.MalformedURLException;
import java.net.URI;
import java.util.Optional;

@Startup
@ApplicationScoped
@IfBuildProfile("dev")
public class DevClusterInitializer {

    private final Logger logger;
    private final KubernetesClient k8s;
    private final WatcherConfigGroup watcherConfig;
    private final PipelineService pipelineService;
    private final Event<ExportedEvent<?, ?>> event;
    private final ObjectMapper objectMapper;

    @Inject
    EntityManager entityManager;

    public DevClusterInitializer(Logger logger, KubernetesClient k8s,
                                 WatcherConfigGroup watcherConfig, PipelineService pipelineService,
                                 Event<ExportedEvent<?, ?>> event, ObjectMapper objectMapper) {
        this.logger = logger;
        this.k8s = k8s;
        this.watcherConfig = watcherConfig;
        this.pipelineService = pipelineService;
        this.event = event;
        this.objectMapper = objectMapper;
    }

    public void init(@Observes StartupEvent event) {
        watcherConfig.crd().ifPresent(this::install);
        initPipelines();
    }

    public void install(String crdUrl) {
        try {
            logger.info("Installing CRD from " + crdUrl);
            var url = URI.create(crdUrl).toURL();
            var crds = k8s.apiextensions().v1().customResourceDefinitions();
            var crd = crds.load(url).item();

            crds.resource(crd).serverSideApply();
        } catch (MalformedURLException e) {
            throw new RuntimeException(e);
        }
    }


    public void initPipelines() {
        logger.info("Firing pipeline update events for existing pipelines");
        pipelineService.list().forEach(pipelineService::onChange);
    }
}
