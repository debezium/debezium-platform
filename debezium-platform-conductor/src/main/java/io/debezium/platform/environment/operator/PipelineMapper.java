/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator;

import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DATABASE;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DEBEZIUM_DATABASE_NAME_CONFIG;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DEBEZIUM_DATABASE_USERNAME_CONFIG;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.USERNAME;
import static io.debezium.platform.environment.database.DatabaseConnectionFactory.DATABASE_CONNECTION_CONFIGURATION_PREFIX;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;

import io.debezium.operator.api.model.ConfigProperties;
import io.debezium.operator.api.model.DebeziumServer;
import io.debezium.operator.api.model.DebeziumServerBuilder;
import io.debezium.operator.api.model.DebeziumServerSpecBuilder;
import io.debezium.operator.api.model.Predicate;
import io.debezium.operator.api.model.PredicateBuilder;
import io.debezium.operator.api.model.Quarkus;
import io.debezium.operator.api.model.QuarkusBuilder;
import io.debezium.operator.api.model.Sink;
import io.debezium.operator.api.model.SinkBuilder;
import io.debezium.operator.api.model.Transformation;
import io.debezium.operator.api.model.TransformationBuilder;
import io.debezium.operator.api.model.runtime.Runtime;
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
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Transform;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.operator.configuration.TableNameResolver;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;

@ApplicationScoped
public class PipelineMapper {

    private static final String SIGNAL_ENABLED_CHANNELS_CONFIG = "signal.enabled.channels";
    private static final String NOTIFICATION_ENABLED_CHANNELS_CONFIG = "notification.enabled.channels";
    private static final String DEFAULT_SIGNAL_CHANNELS = "source,in-process";
    private static final String DEFAULT_NOTIFICATION_CHANNELS = "log";
    private static final String PREDICATE_PREFIX = "p";
    private static final String PREDICATE_ALIAS_FORMAT = "%s%s";
    private static final String QUARKUS_LOG_CATEGORY_FORMAT = "log.category.\"%s\".level";
    private static final String MIN_LOG_LEVEL = "TRACE";
    private static final String LOG_MIN_LEVEL_PROP_NAME = "log.min-level";
    private static final String LOG_LEVEL_PROP_NAME = "log.level";
    private static final String LOG_CONSOLE_JSON_PROP_NAME = "log.console.json";
    private static final List<String> RESOLVABLE_CONFIGS = List.of("jdbc.schema.history.table.name", "jdbc.offset.table.name");

    private static final String KAFKA_CONNECTION_CONFIGURATION_PREFIX = "producer.";
    private static final String MONGODB_CONNECTION_CONFIGURATION_PREFIX = "mongodb";
    private static final String KINESIS_CONNECTION_CONFIGURATION_PREFIX = "kinesis";
    private static final String PUBSUB_CONNECTION_CONFIGURATION_PREFIX = "pubsub";
    private static final String HTTP_CONNECTION_CONFIGURATION_PREFIX = "http";
    private static final String PULSAR_CONNECTION_CONFIGURATION_PREFIX = "pulsar.client";
    private static final String EVENTHUBS_CONNECTION_CONFIGURATION_PREFIX = "eventhubs";
    private static final String REDIS_CONNECTION_CONFIGURATION_PREFIX = "redis";
    private static final String NATS_STREAMING_CONNECTION_CONFIGURATION_PREFIX = "nats-streaming";
    private static final String NATS_JETSTREAM_CONNECTION_CONFIGURATION_PREFIX = "nats-jetstream";
    private static final String PRAVEGA_CONNECTION_CONFIGURATION_PREFIX = "pravega.controller";
    private static final String INFINISPAN_CONNECTION_CONFIGURATION_PREFIX = "infinispan";
    private static final String ROCKETMQ_CONNECTION_CONFIGURATION_PREFIX = "rocketmq.producer";
    private static final String RABBITMQ_CONNECTION_CONFIGURATION_PREFIX = "rabbitmq.connection";
    private static final String RABBITMQ_STREAM_CONNECTION_CONFIGURATION_PREFIX = "rabbitmqstream.connection";
    private static final String MILVUS_CONNECTION_CONFIGURATION_PREFIX = "milvus";
    private static final String QDRANT_CONNECTION_CONFIGURATION_PREFIX = "qdrant";

    final PipelineConfigGroup pipelineConfigGroup;
    final TableNameResolver tableNameResolver;

    public PipelineMapper(PipelineConfigGroup pipelineConfigGroup, TableNameResolver tableNameResolver) {
        this.pipelineConfigGroup = pipelineConfigGroup;
        this.tableNameResolver = tableNameResolver;
    }

    public DebeziumServer map(PipelineFlat pipeline) {

        var dsQuarkus = createQuarkus(pipeline);

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

        return new DebeziumServerBuilder()
                .withMetadata(new ObjectMetaBuilder()
                        .withName(pipeline.getName())
                        .withLabels(Map.of(OperatorPipelineController.LABEL_DBZ_CONDUCTOR_ID, pipeline.getId().toString()))
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
    }

    private Quarkus createQuarkus(PipelineFlat pipeline) {
        var quarkusConfig = new ConfigProperties();

        Map<String, Object> basicLogProperties = Map.of(
                LOG_LEVEL_PROP_NAME, pipeline.getDefaultLogLevel(),
                LOG_MIN_LEVEL_PROP_NAME, MIN_LOG_LEVEL,
                LOG_CONSOLE_JSON_PROP_NAME, false);

        quarkusConfig.setAllProps(basicLogProperties);
        quarkusConfig.setAllProps(extractCategoriesLogs(pipeline));

        return new QuarkusBuilder()
                .withConfig(quarkusConfig)
                .build();
    }

    private Runtime createRuntime() {
        return new RuntimeBuilder()
                .withApi(new RuntimeApiBuilder().withEnabled().build())
                .withMetrics(new MetricsBuilder()
                        .withJmxExporter(new JmxExporterBuilder()
                                .withEnabled()
                                .build())
                        .build())
                .build();
    }

    private Sink createSink(PipelineFlat pipeline) {

        var sink = pipeline.getDestination();
        var sinkConfig = new ConfigProperties();

        if (sink.getConnection() != null) { // backward compatibility
            String configPrefix = prefixResolver(sink.getConnection().getType());
            sink.getConnection().getConfig().forEach((configName, configValue) -> sinkConfig.setProps(configPrefix + configName, configValue));
        }

        sinkConfig.setAllProps(sink.getConfig());

        return new SinkBuilder()
                .withType(sink.getType())
                .withConfig(sinkConfig)
                .build();
    }

    private Source createSource(PipelineFlat pipeline) {

        var source = pipeline.getSource();
        var sourceConfig = new ConfigProperties();

        if (source.getConnection() != null) { // backward compatibility
            String configPrefix = prefixResolver(source.getConnection().getType());
            source.getConnection().getConfig().forEach((configName, configValue) -> sourceConfig.setProps(getName(configName, configPrefix), configValue));
        }

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

    private static String getName(String configName, String configPrefix) {
        return switch (configName) {
            case USERNAME -> configPrefix + DEBEZIUM_DATABASE_USERNAME_CONFIG;
            case DATABASE -> configPrefix + DEBEZIUM_DATABASE_NAME_CONFIG;
            default -> configPrefix + configName;
        };
    }

    private String prefixResolver(ConnectionEntity.Type connectionType) {
        return switch (connectionType) {
            case ORACLE, MYSQL, MARIADB, SQLSERVER, POSTGRESQL -> DATABASE_CONNECTION_CONFIGURATION_PREFIX;
            case MONGODB -> MONGODB_CONNECTION_CONFIGURATION_PREFIX;
            case KAFKA -> KAFKA_CONNECTION_CONFIGURATION_PREFIX;
            case AMAZON_KINESIS -> KINESIS_CONNECTION_CONFIGURATION_PREFIX;
            case GOOGLE_PUB_SUB -> PUBSUB_CONNECTION_CONFIGURATION_PREFIX;
            case HTTP -> HTTP_CONNECTION_CONFIGURATION_PREFIX;
            case APACHE_PULSAR -> PULSAR_CONNECTION_CONFIGURATION_PREFIX;
            case AZURE_EVENTS_HUBS -> EVENTHUBS_CONNECTION_CONFIGURATION_PREFIX;
            case REDIS -> REDIS_CONNECTION_CONFIGURATION_PREFIX;
            case NATS_STREAMING -> NATS_STREAMING_CONNECTION_CONFIGURATION_PREFIX;
            case NATS_JETSTREAM -> NATS_JETSTREAM_CONNECTION_CONFIGURATION_PREFIX;
            case PRAVEGA -> PRAVEGA_CONNECTION_CONFIGURATION_PREFIX;
            case INFINISPAN -> INFINISPAN_CONNECTION_CONFIGURATION_PREFIX;
            case APACHE_ROCKETMQ -> ROCKETMQ_CONNECTION_CONFIGURATION_PREFIX;
            case RABBITMQ_STREAM -> RABBITMQ_CONNECTION_CONFIGURATION_PREFIX;
            case RABBITMQ_NATIVE_STREAM -> RABBITMQ_STREAM_CONNECTION_CONFIGURATION_PREFIX;
            case MILVUS -> MILVUS_CONNECTION_CONFIGURATION_PREFIX;
            case QDRANT -> QDRANT_CONNECTION_CONFIGURATION_PREFIX;
        };
    }

    private Map<String, Object> extractCategoriesLogs(PipelineFlat pipeline) {
        return pipeline.getLogLevels().entrySet().stream()
                .collect(Collectors.toMap(
                        entry -> toQuarkusFormat(entry.getKey()),
                        Map.Entry::getValue,
                        (v1, v2) -> v1,
                        HashMap::new));
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

        RESOLVABLE_CONFIGS.forEach(
                prop -> schemaHistoryProps.setProps(prop, tableNameResolver.resolve(pipeline, schemaHistoryStorageConfigs.get(prop))));

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

        RESOLVABLE_CONFIGS.forEach(
                prop -> offsetStorageProps.setProps(prop, tableNameResolver.resolve(pipeline, pipelineOffsetConfigs.get(prop))));

        return new OffsetBuilder().withStore(new CustomStoreBuilder()
                .withType(offsetType)
                .withConfig(offsetStorageProps)
                .build()).build();
    }

    private static String toQuarkusFormat(String key) {
        return String.format(PipelineMapper.QUARKUS_LOG_CATEGORY_FORMAT, key);
    }
}
