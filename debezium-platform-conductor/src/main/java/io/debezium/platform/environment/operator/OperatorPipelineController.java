package io.debezium.platform.environment.operator;

import io.debezium.operator.api.model.ConfigProperties;
import io.debezium.operator.api.model.DebeziumServer;
import io.debezium.operator.api.model.DebeziumServerBuilder;
import io.debezium.operator.api.model.DebeziumServerSpecBuilder;
import io.debezium.operator.api.model.QuarkusBuilder;
import io.debezium.operator.api.model.SinkBuilder;
import io.debezium.operator.api.model.runtime.RuntimeBuilder;
import io.debezium.operator.api.model.runtime.metrics.JmxExporterBuilder;
import io.debezium.operator.api.model.runtime.metrics.MetricsBuilder;
import io.debezium.operator.api.model.source.OffsetBuilder;
import io.debezium.operator.api.model.source.SchemaHistoryBuilder;
import io.debezium.operator.api.model.source.SourceBuilder;
import io.debezium.operator.api.model.source.storage.offset.InMemoryOffsetStore;
import io.debezium.operator.api.model.source.storage.schema.InMemorySchemaHistoryStore;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.PipelineController;
import io.debezium.platform.environment.operator.logs.KubernetesLogReader;
import io.debezium.platform.environment.logs.LogReader;
import io.fabric8.kubernetes.api.model.ObjectMeta;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.TailPrettyLoggable;
import jakarta.enterprise.context.Dependent;

import java.util.Map;
import java.util.Optional;


@Dependent
public class OperatorPipelineController implements PipelineController {

    public static final String LABEL_DBZ_CONDUCTOR_ID = "debezium.io/conductor-id";

    private final KubernetesClient k8s;

    public OperatorPipelineController(KubernetesClient k8s) {
        this.k8s = k8s;
    }

    @Override
    public void deploy(PipelineFlat pipeline) {
        // Create DS quarkus configuration
        var quarkusConfig = new ConfigProperties();
        quarkusConfig.setAllProps(Map.of(
                "log.level", pipeline.getLogLevel(),
                "log.console.json", false
        ));
        var dsQuarkus = new QuarkusBuilder()
                .withConfig(quarkusConfig)
                .build();

        var dsRuntime = new RuntimeBuilder()
                .withMetrics(new MetricsBuilder()
                        .withJmxExporter(new JmxExporterBuilder()
                                .withEnabled()
                                .build())
                        .build())
                .build();

        // Create DS source configuration
        var source = pipeline.getSource();
        var sourceConfig = new ConfigProperties();
        sourceConfig.setAllProps(source.getConfig());

        // TODO: offset and schema history type should be configurable in the future
        var offset = new OffsetBuilder()
                .withMemory(new InMemoryOffsetStore())
                .build();
        var schemaHistory = new SchemaHistoryBuilder()
                .withMemory(new InMemorySchemaHistoryStore())
                .build();

        var dsSource = new SourceBuilder()
                .withSourceClass(source.getType())
                .withOffset(offset)
                .withSchemaHistory(schemaHistory)
                .withConfig(sourceConfig)
                .build();

        // Create DS sink configuration
        var sink = pipeline.getDestination();
        var sinkConfig = new ConfigProperties();
        sinkConfig.setAllProps(sink.getConfig());

        var dsSink = new SinkBuilder()
                .withType(sink.getType())
                .withConfig(sinkConfig)
                .build();

        // Create DS resource
        var ds = new DebeziumServerBuilder()
                .withMetadata(new ObjectMetaBuilder()
                        .withName(pipeline.getName())
                        .withLabels(Map.of(LABEL_DBZ_CONDUCTOR_ID, pipeline.getId().toString()))
                        .build())
                .withSpec(new DebeziumServerSpecBuilder()
                        .withQuarkus(dsQuarkus)
                        .withRuntime(dsRuntime)
                        .withSource(dsSource)
                        .withSink(dsSink)
                        .build())
                .build();

        // apply to server
        k8s.resource(ds).serverSideApply();
    }

    @Override
    public void undeploy(Long id) {
        k8s.resources(DebeziumServer.class)
                .withLabels(Map.of(LABEL_DBZ_CONDUCTOR_ID, id.toString()))
                .delete();
    }

    @Override
    public void stop(Long id) {
        stop(id, true);
    }

    @Override
    public void start(Long id) {
        stop(id, false);
    }

    public Optional<DebeziumServer> findById(Long id) {
        return k8s.resources(DebeziumServer.class)
                .withLabels(Map.of(LABEL_DBZ_CONDUCTOR_ID, id.toString()))
                .list()
                .getItems()
                .stream()
                .findFirst();
    }

    private TailPrettyLoggable findDeploymentLoggable(Long id) {
        return findById(id)
                .map(DebeziumServer::getMetadata)
                .map(ObjectMeta::getName)
                .map(name -> k8s.apps().deployments().withName(name))
                .get();
    }

    @Override
    public LogReader logReader(Long id) {
        return new KubernetesLogReader(() -> findDeploymentLoggable(id));
    }

    private void stop(Long id, boolean stop) {
        findById(id).ifPresent(ds -> {
            ds.setStopped(stop);
            k8s.resource(ds).serverSideApply();
        });
    }
}
