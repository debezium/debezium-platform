/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import jakarta.enterprise.context.Dependent;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.DebeziumException;
import io.debezium.operator.api.model.ConfigProperties;
import io.debezium.operator.api.model.DebeziumServer;
import io.debezium.operator.api.model.DebeziumServerBuilder;
import io.debezium.operator.api.model.DebeziumServerSpecBuilder;
import io.debezium.operator.api.model.Predicate;
import io.debezium.operator.api.model.PredicateBuilder;
import io.debezium.operator.api.model.QuarkusBuilder;
import io.debezium.operator.api.model.Sink;
import io.debezium.operator.api.model.SinkBuilder;
import io.debezium.operator.api.model.Transformation;
import io.debezium.operator.api.model.TransformationBuilder;
import io.debezium.operator.api.model.runtime.RuntimeApiBuilder;
import io.debezium.operator.api.model.runtime.RuntimeBuilder;
import io.debezium.operator.api.model.runtime.metrics.JmxExporterBuilder;
import io.debezium.operator.api.model.runtime.metrics.MetricsBuilder;
import io.debezium.operator.api.model.source.Offset;
import io.debezium.operator.api.model.source.OffsetBuilder;
import io.debezium.operator.api.model.source.SchemaHistory;
import io.debezium.operator.api.model.source.SchemaHistoryBuilder;
import io.debezium.operator.api.model.source.Source;
import io.debezium.operator.api.model.source.SourceBuilder;
import io.debezium.operator.api.model.source.storage.CustomStoreBuilder;
import io.debezium.platform.config.PipelineConfigGroup;
import io.debezium.platform.domain.Signal;
import io.debezium.platform.domain.views.Transform;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.PipelineController;
import io.debezium.platform.environment.logs.LogReader;
import io.debezium.platform.environment.operator.actions.DebeziumKubernetesAdapter;
import io.debezium.platform.environment.operator.actions.DebeziumServerProxy;
import io.debezium.platform.environment.operator.configuration.TableNameResolver;
import io.debezium.platform.environment.operator.logs.KubernetesLogReader;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;

@Dependent
public class OperatorPipelineController implements PipelineController {

    private static final Logger LOGGER = LoggerFactory.getLogger(OperatorPipelineController.class);

    public static final String LABEL_DBZ_CONDUCTOR_ID = "debezium.io/conductor-id";
    private static final List<String> RESOLVABLE_CONFIGS = List.of("jdbc.schema.history.table.name", "jdbc.offset.table.name");
    private static final String PREDICATE_PREFIX = "p";
    private static final String PREDICATE_ALIAS_FORMAT = "%s%s";
    private static final String SIGNAL_ENABLED_CHANNELS_CONFIG = "signal.enabled.channels";
    private static final String NOTIFICATION_ENABLED_CHANNELS_CONFIG = "notification.enabled.channels";
    private static final String DEFAULT_SIGNAL_CHANNELS = "source,in-process";
    private static final String DEFAULT_NOTIFICATION_CHANNELS = "log";
    private static final String QUARKUS_LOG_CATEGORY_FORMAT = "log.category.\"%s\".level";
    private static final String MIN_LOG_LEVEL = "TRACE";
    private static final String LOG_MIN_LEVEL_PROP_NAME = "log.min-level";
    private static final String LOG_LEVEL_PROP_NAME = "log.level";
    private static final String LOG_CONSOLE_JSON_PROP_NAME = "log.console.json";

    private final DebeziumKubernetesAdapter kubernetesAdapter;
    private final PipelineConfigGroup pipelineConfigGroup;
    private final TableNameResolver tableNameResolver;
    private final DebeziumServerProxy debeziumServerProxy;

    public OperatorPipelineController(DebeziumKubernetesAdapter kubernetesAdapter,
                                      PipelineConfigGroup pipelineConfigGroup,
                                      TableNameResolver tableNameResolver,
                                      DebeziumServerProxy debeziumServerProxy) {
        this.kubernetesAdapter = kubernetesAdapter;
        this.pipelineConfigGroup = pipelineConfigGroup;
        this.tableNameResolver = tableNameResolver;
        this.debeziumServerProxy = debeziumServerProxy;
    }

    @Override
    public void deploy(PipelineFlat pipeline) {

        var quarkusConfig = createQuarkusConfig(pipeline);

        var dsQuarkus = new QuarkusBuilder()
                .withConfig(quarkusConfig)
                .build();

        var dsRuntime = createRuntime();

        var dsSource = createSource(pipeline);

        var dsSink = createSink(pipeline);

        List<Transformation> transformations = pipeline.getTransforms().stream()
                .map(this::buildTransformation)
                .toList();

        Map<String, Predicate> predicates = pipeline.getTransforms().stream()
                .collect(Collectors.toMap(
                        this::getPredicateName,
                        this::buildPredicate));

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
                        .withTransforms(transformations)
                        .withPredicates(predicates)
                        .build())
                .build();

        LOGGER.debug("Going to deploy resource {}", ds);
        // apply to server
        kubernetesAdapter.deployPipeline(ds);
    }

    private static ConfigProperties createQuarkusConfig(PipelineFlat pipeline) {
        var quarkusConfig = new ConfigProperties();

        Map<String, Object> basicLogProperties = Map.of(
                LOG_LEVEL_PROP_NAME, pipeline.getDefaultLogLevel(),
                LOG_MIN_LEVEL_PROP_NAME, MIN_LOG_LEVEL,
                LOG_CONSOLE_JSON_PROP_NAME, false);

        quarkusConfig.setAllProps(basicLogProperties);
        quarkusConfig.setAllProps(extractCategoriesLogs(pipeline));
        return quarkusConfig;
    }

    private static io.debezium.operator.api.model.runtime.Runtime createRuntime() {
        return new RuntimeBuilder()
                .withApi(new RuntimeApiBuilder().withEnabled().build())
                .withMetrics(new MetricsBuilder()
                        .withJmxExporter(new JmxExporterBuilder()
                                .withEnabled()
                                .build())
                        .build())
                .build();
    }

    private static Sink createSink(PipelineFlat pipeline) {
        var sink = pipeline.getDestination();
        // TODO get connection config based on the type of the connection sink.getConnection().getConfig()
        var sinkConfig = new ConfigProperties();
        sinkConfig.setAllProps(sink.getConfig());

        return new SinkBuilder()
                .withType(sink.getType())
                .withConfig(sinkConfig)
                .build();
    }

    private Source createSource(PipelineFlat pipeline) {

        var source = pipeline.getSource();
        // TODO get connection config based on the type of the connection source.getConnection().getConfig()
        var sourceConfig = new ConfigProperties();
        sourceConfig.setAllProps(source.getConfig());
        sourceConfig.setProps(SIGNAL_ENABLED_CHANNELS_CONFIG, DEFAULT_SIGNAL_CHANNELS);
        sourceConfig.setProps(NOTIFICATION_ENABLED_CHANNELS_CONFIG, DEFAULT_NOTIFICATION_CHANNELS);

        return new SourceBuilder()
                .withSourceClass(source.getType())
                .withOffset(getOffset(pipeline))
                .withSchemaHistory(getSchemaHistory(pipeline))
                .withConfig(sourceConfig)
                .build();
    }

    private static Map<String, Object> extractCategoriesLogs(PipelineFlat pipeline) {
        return pipeline.getLogLevels().entrySet().stream()
                .collect(Collectors.toMap(
                        entry -> toQuarkusFormat(entry.getKey()),
                        Map.Entry::getValue,
                        (v1, v2) -> v1,
                        HashMap::new));
    }

    private static String toQuarkusFormat(String key) {
        return String.format(QUARKUS_LOG_CATEGORY_FORMAT, key);
    }

    private Predicate buildPredicate(Transform transform) {

        var predicateConfig = new ConfigProperties();
        predicateConfig.setAllProps(transform.getPredicate().getConfig());

        return new PredicateBuilder()
                .withType(transform.getPredicate().getType())
                .withConfig(predicateConfig)
                .build();
    }

    private Transformation buildTransformation(Transform transform) {

        var transformConfig = new ConfigProperties();
        transformConfig.setAllProps(transform.getConfig());

        return new TransformationBuilder()
                .withType(transform.getType())
                .withConfig(transformConfig)
                .withPredicate(getPredicateName(transform))
                .withNegate(transform.getPredicate().isNegate())
                .build();

    }

    private String getPredicateName(Transform transform) {
        return String.format(PREDICATE_ALIAS_FORMAT, PREDICATE_PREFIX, transform.getId());
    }

    private SchemaHistory getSchemaHistory(PipelineFlat pipeline) {

        var pipelineSchemaHistoryConfigs = pipelineConfigGroup.schema().config();
        var schemaHistoryType = pipelineConfigGroup.schema().internal();

        Map<String, String> schemaHistoryStorageConfigs = new HashMap<>(pipelineSchemaHistoryConfigs);
        ConfigProperties schemaHistoryProps = new ConfigProperties();
        schemaHistoryStorageConfigs.forEach(schemaHistoryProps::setProps);

        RESOLVABLE_CONFIGS.forEach(prop -> schemaHistoryProps.setProps(prop, tableNameResolver.resolve(pipeline, schemaHistoryStorageConfigs.get(prop))));

        return new SchemaHistoryBuilder().withStore(new CustomStoreBuilder()
                .withType(schemaHistoryType)
                .withConfig(schemaHistoryProps)
                .build()).build();
    }

    private Offset getOffset(PipelineFlat pipeline) {

        var pipelineOffsetConfigs = pipelineConfigGroup.offset().storage().config();
        var offsetType = pipelineConfigGroup.offset().storage().type();

        Map<String, String> offsetStorageConfigs = new HashMap<>(pipelineOffsetConfigs);
        ConfigProperties offsetStorageProps = new ConfigProperties();
        offsetStorageConfigs.forEach(offsetStorageProps::setProps);

        RESOLVABLE_CONFIGS.forEach(prop -> offsetStorageProps.setProps(prop, tableNameResolver.resolve(pipeline, pipelineOffsetConfigs.get(prop))));

        return new OffsetBuilder().withStore(new CustomStoreBuilder()
                .withType(offsetType)
                .withConfig(offsetStorageProps)
                .build()).build();
    }

    @Override
    public void undeploy(Long pipelineId) {
        kubernetesAdapter.undeployPipeline(pipelineId);
    }

    @Override
    public void stop(Long id) {
        kubernetesAdapter.changeStatus(id, true);
    }

    @Override
    public void start(Long id) {
        kubernetesAdapter.changeStatus(id, false);
    }

    public Optional<DebeziumServer> findById(Long id) {
        return kubernetesAdapter.findAssociatedDebeziumServer(id);
    }

    @Override
    public LogReader logReader(Long id) {
        return new KubernetesLogReader(() -> kubernetesAdapter.findLoggableDeployment(id));
    }

    @Override
    public void sendSignal(Long pipelineId, Signal signal) {
        findById(pipelineId).ifPresentOrElse(
                debeziumServer -> debeziumServerProxy.sendSignal(signal, debeziumServer),
                () -> {
                    throw new DebeziumException(String.format("Pipeline with id %s not found", pipelineId));
                });
    }
}
