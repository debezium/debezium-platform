/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DATABASE;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DEBEZIUM_DATABASE_NAME_CONFIG;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DEBEZIUM_DATABASE_USERNAME_CONFIG;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DEBEZIUM_SQLSERVER_DATABASE_NAME_CONFIG;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.USERNAME;
import static io.debezium.platform.environment.database.DatabaseConnectionFactory.DATABASE_CONNECTION_CONFIGURATION_PREFIX;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;

import io.debezium.platform.config.PipelineConfigGroup;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Transform;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.operator.configuration.TableNameResolver;

/**
 * Converts a {@link PipelineFlat} into a flat Debezium Server
 * {@code application.properties} string suitable for host-mode deployment.
 *
 * <p>Mirrors the mapping logic in
 * {@link io.debezium.platform.environment.operator.PipelineMapper}
 * but produces a flat key=value string instead of a Kubernetes CRD.
 *
 * <p><strong>Deterministic output:</strong> A {@link TreeMap} ensures
 * alphabetical key ordering, and manual serialization (not
 * {@link java.util.Properties#store}) avoids the non-deterministic
 * timestamp comment. Both are critical for stable SHA-256 hashing
 * used in config drift detection.
 */
@ApplicationScoped
public class HostPipelineMapper {

    // ── Debezium Server property prefixes ──
    private static final String SOURCE_PREFIX = "debezium.source.";
    private static final String SINK_PREFIX = "debezium.sink.";
    private static final String TRANSFORMS_KEY = "debezium.transforms";
    private static final String PREDICATES_KEY = "debezium.predicates";
    private static final String QUARKUS_PREFIX = "quarkus.";

    // ── Source property keys (appended after SOURCE_PREFIX) ──
    private static final String CONNECTOR_CLASS_KEY = "connector.class";
    private static final String OFFSET_STORAGE_KEY = "offset.storage";
    private static final String OFFSET_STORAGE_DOT = "offset.storage.";
    private static final String SCHEMA_HISTORY_KEY = "schema.history.internal";
    private static final String SCHEMA_HISTORY_DOT = "schema.history.internal.";

    // ── Signal / notification defaults ──
    private static final String SIGNAL_ENABLED_CHANNELS_KEY = "signal.enabled.channels";
    private static final String NOTIFICATION_ENABLED_CHANNELS_KEY = "notification.enabled.channels";
    private static final String DEFAULT_SIGNAL_CHANNELS = "source,in-process";
    private static final String DEFAULT_NOTIFICATION_CHANNELS = "log";

    // ── Quarkus logging keys ──
    private static final String LOG_LEVEL_KEY = "log.level";
    private static final String LOG_MIN_LEVEL_KEY = "log.min-level";
    private static final String LOG_CONSOLE_JSON_KEY = "log.console.json";
    private static final String MIN_LOG_LEVEL = "TRACE";
    private static final String LOG_CATEGORY_FORMAT = "log.category.\"%s\".level";

    // ── Connection type → config key prefix mapping ──
    private static final String MONGODB_PREFIX = "mongodb.";
    private static final String KAFKA_PRODUCER_PREFIX = "producer.";
    private static final String PULSAR_CLIENT_PREFIX = "pulsar.client.";
    private static final String RABBITMQ_CONNECTION_PREFIX = "rabbitmq.connection.";
    private static final String RABBITMQ_STREAM_CONNECTION_PREFIX = "rabbitmqstream.connection.";
    private static final String JDBC_CONNECTION_PREFIX = "connection.";
    private static final String EMPTY_PREFIX = "";

    // ── Sink type resolution ──
    private static final String SERVER_SINK_FQCN_PREFIX = "io.debezium.server.";
    private static final Map<String, String> SINK_TYPE_OVERRIDES = Map.of(
            "io.debezium.server.pubsub.PubSubLiteChangeConsumer", "pubsublite",
            "io.debezium.server.rabbitmq.RabbitMqStreamNativeChangeConsumer", "rabbitmqstream",
            "io.debezium.server.nats.jetstream.NatsJetStreamChangeConsumer", "nats-jetstream",
            "io.debezium.server.nats.streaming.NatsStreamingChangeConsumer", "nats-streaming");

    // ── Serialization ──
    private static final String PROPERTY_SEPARATOR = "=";
    private static final String LINE_SEPARATOR = "\n";
    private static final String PREDICATE_ALIAS_PREFIX = "p";
    private static final String ALIAS_SEPARATOR = ",";

    // ── Hashing ──
    private static final String HASH_ALGORITHM = "SHA-256";

    // ── Resolvable table name configs (same as operator PipelineMapper) ──
    private static final List<String> RESOLVABLE_CONFIGS = List.of(
            "jdbc.schema.history.table.name",
            "jdbc.offset.table.name");

    private final PipelineConfigGroup pipelineConfigGroup;
    private final TableNameResolver tableNameResolver;

    public HostPipelineMapper(PipelineConfigGroup pipelineConfigGroup,
                              TableNameResolver tableNameResolver) {
        this.pipelineConfigGroup = pipelineConfigGroup;
        this.tableNameResolver = tableNameResolver;
    }

    /**
     * Result of mapping a pipeline to its Debezium Server configuration.
     *
     * @param propertiesContent the flat {@code application.properties} content
     * @param configHash        SHA-256 hex digest for drift detection
     */
    public record MappedConfig(String propertiesContent, String configHash) {
    }

    /**
     * Maps a {@link PipelineFlat} to a Debezium Server
     * {@code application.properties} string and its SHA-256 hash.
     *
     * @param pipeline the pipeline to map
     * @return the mapped configuration with its content hash
     */
    public MappedConfig map(PipelineFlat pipeline) {
        var properties = new TreeMap<String, String>();

        addSourceProperties(pipeline, properties);
        addSinkProperties(pipeline, properties);
        addTransformProperties(pipeline, properties);
        addOffsetStorageProperties(pipeline, properties);
        addSchemaHistoryProperties(pipeline, properties);
        addQuarkusProperties(pipeline, properties);

        String content = serializeProperties(properties);
        String hash = computeConfigHash(content);

        return new MappedConfig(content, hash);
    }

    private void addSourceProperties(PipelineFlat pipeline, TreeMap<String, String> properties) {
        var source = pipeline.getSource();

        properties.put(SOURCE_PREFIX + CONNECTOR_CLASS_KEY, source.getType());

        if (source.getConnection() != null) {
            String configPrefix = resolveConnectionPrefix(source.getConnection().getType());
            ConnectionEntity.Type connectionType = source.getConnection().getType();

            source.getConnection().getConfig().forEach((configName, configValue) -> properties.put(
                    SOURCE_PREFIX + resolveSourceConfigName(connectionType, configName, configPrefix),
                    String.valueOf(configValue)));
        }

        source.getConfig().forEach((key, value) -> properties.put(SOURCE_PREFIX + key, String.valueOf(value)));

        // Platform-required defaults applied LAST so user config cannot override them
        // (matches operator PipelineMapper.createSource() ordering)
        properties.put(SOURCE_PREFIX + SIGNAL_ENABLED_CHANNELS_KEY, DEFAULT_SIGNAL_CHANNELS);
        properties.put(SOURCE_PREFIX + NOTIFICATION_ENABLED_CHANNELS_KEY, DEFAULT_NOTIFICATION_CHANNELS);
    }

    private void addSinkProperties(PipelineFlat pipeline, TreeMap<String, String> properties) {
        var sink = pipeline.getDestination();
        String sinkType = resolveSinkType(sink.getType());

        properties.put(SINK_PREFIX + "type", sinkType);

        if (sink.getConnection() != null) {
            String configPrefix = resolveConnectionPrefix(sink.getConnection().getType());

            sink.getConnection().getConfig().forEach((configName, configValue) -> properties.put(
                    SINK_PREFIX + sinkType + "." + configPrefix + configName,
                    String.valueOf(configValue)));
        }

        sink.getConfig().forEach((key, value) -> properties.put(SINK_PREFIX + sinkType + "." + key, String.valueOf(value)));
    }

    private void addTransformProperties(PipelineFlat pipeline, TreeMap<String, String> properties) {
        List<Transform> transforms = pipeline.getTransforms();
        if (transforms == null || transforms.isEmpty()) {
            return;
        }

        String aliases = transforms.stream()
                .map(t -> t.getName())
                .collect(Collectors.joining(ALIAS_SEPARATOR));

        properties.put(TRANSFORMS_KEY, aliases);

        List<String> predicateNames = new ArrayList<>();

        transforms.forEach(transform -> {
            String alias = transform.getName();
            String prefix = TRANSFORMS_KEY + "." + alias + ".";

            properties.put(prefix + "type", transform.getType());

            transform.getConfig().forEach((key, value) -> properties.put(prefix + key, String.valueOf(value)));

            if (hasPredicate(transform)) {
                String predicateName = PREDICATE_ALIAS_PREFIX + transform.getId();
                predicateNames.add(predicateName);

                properties.put(prefix + "predicate", predicateName);
                if (transform.getPredicate().isNegate()) {
                    properties.put(prefix + "negate", "true");
                }

                String predicatePrefix = PREDICATES_KEY + "." + predicateName + ".";
                properties.put(predicatePrefix + "type", transform.getPredicate().getType());

                transform.getPredicate().getConfig().forEach((key, value) -> properties.put(predicatePrefix + key, String.valueOf(value)));
            }
        });

        if (!predicateNames.isEmpty()) {
            properties.put(PREDICATES_KEY, String.join(ALIAS_SEPARATOR, predicateNames));
        }
    }

    private void addOffsetStorageProperties(PipelineFlat pipeline, TreeMap<String, String> properties) {
        var offsetConfig = pipelineConfigGroup.offset().storage();

        properties.put(SOURCE_PREFIX + OFFSET_STORAGE_KEY, offsetConfig.type());

        Map<String, String> storageConfigs = new HashMap<>(offsetConfig.config());
        storageConfigs.forEach((key, value) -> properties.put(SOURCE_PREFIX + OFFSET_STORAGE_DOT + key, value));

        RESOLVABLE_CONFIGS.forEach(prop -> {
            String resolved = tableNameResolver.resolve(pipeline, storageConfigs.get(prop));
            if (resolved != null) {
                properties.put(SOURCE_PREFIX + OFFSET_STORAGE_DOT + prop, resolved);
            }
        });
    }

    private void addSchemaHistoryProperties(PipelineFlat pipeline, TreeMap<String, String> properties) {
        var schemaConfig = pipelineConfigGroup.schema();

        properties.put(SOURCE_PREFIX + SCHEMA_HISTORY_KEY, schemaConfig.internal());

        Map<String, String> historyConfigs = new HashMap<>(schemaConfig.config());
        historyConfigs.forEach((key, value) -> properties.put(SOURCE_PREFIX + SCHEMA_HISTORY_DOT + key, value));

        RESOLVABLE_CONFIGS.forEach(prop -> {
            String resolved = tableNameResolver.resolve(pipeline, historyConfigs.get(prop));
            if (resolved != null) {
                properties.put(SOURCE_PREFIX + SCHEMA_HISTORY_DOT + prop, resolved);
            }
        });
    }

    private void addQuarkusProperties(PipelineFlat pipeline, TreeMap<String, String> properties) {
        properties.put(QUARKUS_PREFIX + LOG_LEVEL_KEY, pipeline.getDefaultLogLevel());
        properties.put(QUARKUS_PREFIX + LOG_MIN_LEVEL_KEY, MIN_LOG_LEVEL);
        properties.put(QUARKUS_PREFIX + LOG_CONSOLE_JSON_KEY, "false");

        pipeline.getLogLevels().forEach((category, level) -> properties.put(QUARKUS_PREFIX + String.format(LOG_CATEGORY_FORMAT, category), level));
    }

    /**
     * Resolves the config key prefix for a given connection type.
     * Mirrors {@code PipelineMapper.prefixResolver()}.
     */
    private static String resolveConnectionPrefix(ConnectionEntity.Type connectionType) {
        return switch (connectionType) {
            case ORACLE, MYSQL, MARIADB, SQLSERVER, POSTGRESQL -> DATABASE_CONNECTION_CONFIGURATION_PREFIX;
            case MONGODB -> MONGODB_PREFIX;
            case KAFKA -> KAFKA_PRODUCER_PREFIX;
            case APACHE_PULSAR -> PULSAR_CLIENT_PREFIX;
            case RABBITMQ_STREAM -> RABBITMQ_CONNECTION_PREFIX;
            case RABBITMQ_NATIVE_STREAM -> RABBITMQ_STREAM_CONNECTION_PREFIX;
            case JDBC -> JDBC_CONNECTION_PREFIX;
            case AMAZON_KINESIS, APACHE_ROCKETMQ, QDRANT, MILVUS, INFINISPAN, PRAVEGA,
                    NATS_JETSTREAM, NATS_STREAMING, REDIS, AZURE_EVENTS_HUBS, HTTP,
                    GOOGLE_PUB_SUB, AMAZON_SQS ->
                EMPTY_PREFIX;
        };
    }

    /**
     * Resolves special source config field names for database connections.
     * Mirrors {@code PipelineMapper.getName()}.
     */
    private static String resolveSourceConfigName(ConnectionEntity.Type connectionType,
                                                  String configName, String configPrefix) {
        return switch (configName) {
            case USERNAME -> configPrefix + DEBEZIUM_DATABASE_USERNAME_CONFIG;
            case DATABASE -> configPrefix + resolveDatabaseNameConfig(connectionType);
            default -> configPrefix + configName;
        };
    }

    private static String resolveDatabaseNameConfig(ConnectionEntity.Type connectionType) {
        return connectionType == ConnectionEntity.Type.SQLSERVER
                ? DEBEZIUM_SQLSERVER_DATABASE_NAME_CONFIG
                : DEBEZIUM_DATABASE_NAME_CONFIG;
    }

    /**
     * Resolves the Debezium Server sink type from a FQCN to the short
     * {@code @Named} identifier expected by {@code debezium.sink.type}.
     * Mirrors {@code PipelineMapper.resolveSinkType()}.
     */
    static String resolveSinkType(String type) {
        if (type == null || !type.contains(".")) {
            return type;
        }

        String override = SINK_TYPE_OVERRIDES.get(type);
        if (override != null) {
            return override;
        }

        if (type.startsWith(SERVER_SINK_FQCN_PREFIX)) {
            String afterPrefix = type.substring(SERVER_SINK_FQCN_PREFIX.length());
            int dotIndex = afterPrefix.indexOf('.');
            if (dotIndex > 0) {
                return afterPrefix.substring(0, dotIndex);
            }
        }

        return type;
    }

    private static boolean hasPredicate(Transform transform) {
        return transform.getPredicate() != null && transform.getPredicate().getType() != null;
    }

    /**
     * Serializes the properties map to a flat key=value string without
     * the timestamp comment that {@link java.util.Properties#store} injects.
     */
    private static String serializeProperties(TreeMap<String, String> properties) {
        return properties.entrySet().stream()
                .map(entry -> entry.getKey() + PROPERTY_SEPARATOR + entry.getValue())
                .collect(Collectors.joining(LINE_SEPARATOR));
    }

    /**
     * Computes a SHA-256 hex digest of the given content string.
     *
     * <p>The deterministic key ordering from {@link TreeMap} and the
     * absence of a timestamp comment in the serialized output guarantee
     * that identical pipeline configurations always produce the same hash,
     * enabling reliable config drift detection.
     */
    static String computeConfigHash(String content) {
        try {
            MessageDigest digest = MessageDigest.getInstance(HASH_ALGORITHM);
            byte[] hash = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        }
        catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandatory in every JDK — this should never happen
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }
}
