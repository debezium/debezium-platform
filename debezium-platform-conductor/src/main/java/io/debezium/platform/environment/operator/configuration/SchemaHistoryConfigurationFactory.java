/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.configuration;

import io.debezium.DebeziumException;
import io.debezium.operator.api.model.source.SchemaHistory;
import io.debezium.operator.api.model.source.SchemaHistoryBuilder;
import io.debezium.operator.api.model.source.storage.RedisStoreWaitConfigBuilder;
import io.debezium.operator.api.model.source.storage.schema.FileSchemaHistoryStoreBuilder;
import io.debezium.operator.api.model.source.storage.schema.InMemorySchemaHistoryStore;
import io.debezium.operator.api.model.source.storage.schema.JdbcSchemaHistoryStoreBuilder;
import io.debezium.operator.api.model.source.storage.schema.JdbcSchemaHistoryTableConfigBuilder;
import io.debezium.operator.api.model.source.storage.schema.KafkaSchemaHistoryStoreBuilder;
import io.debezium.operator.api.model.source.storage.schema.RedisSchemaHistoryStoreBuilder;
import io.debezium.platform.config.PipelineConfigGroup;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.operator.configuration.common.KafkaStoreConfig;
import io.debezium.platform.environment.operator.configuration.common.RedisStoreConfig;
import io.debezium.storage.jdbc.JdbcCommonConfig;
import jakarta.enterprise.context.Dependent;

import java.util.Map;

@Dependent
public class SchemaHistoryConfigurationFactory {

    private static final String JDBC = "io.debezium.storage.jdbc.history.JdbcSchemaHistory";
    private static final String FILE = "io.debezium.storage.file.history.FileSchemaHistory";
    private static final String IN_MEMORY = "io.debezium.relational.history.MemorySchemaHistory";
    private static final String KAFKA = "io.debezium.storage.kafka.history.KafkaSchemaHistory";
    private static final String REDIS = "io.debezium.storage.redis.history.RedisSchemaHistory";
    private static final String SCHEMA_HISTORY_SUFFIX = "schema_history";
    private static final String FILE_SCHEMA_HISTORY_STORE_FILE_FILENAME_CONFIG = "file.filename";

    private final PipelineConfigGroup pipelineConfigGroup;
    private final TableNameResolver tableNameResolver;

    public SchemaHistoryConfigurationFactory(PipelineConfigGroup pipelineConfigGroup, TableNameResolver tableNameResolver) {

        this.pipelineConfigGroup = pipelineConfigGroup;
        this.tableNameResolver = tableNameResolver;
    }

    public SchemaHistory create(PipelineFlat pipeline) {

        var pipelineOffsetConfigs = pipelineConfigGroup.schema().config();
        var type = pipelineConfigGroup.schema().internal();
        return switch (type) {
            case JDBC -> buildJdbcConfigs(pipeline, pipelineOffsetConfigs);
            case FILE -> buildFileConfigs(pipelineOffsetConfigs);
            case IN_MEMORY -> new SchemaHistoryBuilder().withMemory(new InMemorySchemaHistoryStore()).build();
            case KAFKA -> buildKafkaConfigs(pipelineOffsetConfigs);
            case REDIS -> buildRedisConfigs(pipelineOffsetConfigs);
            default -> throw new DebeziumException(String.format("Schema history %s not supported", type));
        };
    }

    private SchemaHistory buildKafkaConfigs(Map<String, String> pipelineOffsetConfigs) {

        KafkaStoreConfig kafkaStoreConfig = KafkaStoreConfig.from(pipelineOffsetConfigs);

        return new SchemaHistoryBuilder()
                .withKafka(new KafkaSchemaHistoryStoreBuilder()
                        .withBootstrapServers(kafkaStoreConfig.bootstrapServers())
                        .withTopic(kafkaStoreConfig.topic())
                        .withPartitions(kafkaStoreConfig.partitions())
                        .withReplicationFactor(kafkaStoreConfig.replicationFactor())
                        .build())
                .build();
    }

    private SchemaHistory buildFileConfigs(Map<String, String> pipelineOffsetConfigs) {

        return new SchemaHistoryBuilder().withFile(new FileSchemaHistoryStoreBuilder()
                        .withFileName(pipelineOffsetConfigs.get(FILE_SCHEMA_HISTORY_STORE_FILE_FILENAME_CONFIG))
                        .build())
                .build();
    }

    private SchemaHistory buildJdbcConfigs(PipelineFlat pipeline, Map<String, String> pipelineOffsetConfigs) {

        return new SchemaHistoryBuilder()
                .withJdbc(new JdbcSchemaHistoryStoreBuilder()
                        .withUrl(pipelineOffsetConfigs.get(JdbcCommonConfig.PROP_JDBC_URL.name()))
                        .withUser(pipelineOffsetConfigs.get(JdbcCommonConfig.PROP_USER.name()))
                        .withPassword(pipelineOffsetConfigs.get(JdbcCommonConfig.PROP_PASSWORD.name()))
                        .withTable(new JdbcSchemaHistoryTableConfigBuilder()
                                .withName(tableNameResolver.resolve(pipeline, SCHEMA_HISTORY_SUFFIX))
                                .build())
                        .build())
                .build();
    }

    private SchemaHistory buildRedisConfigs(Map<String, String> pipelineOffsetConfigs) {

        RedisStoreConfig redisStoreConfig = RedisStoreConfig.from(pipelineOffsetConfigs);
        return new SchemaHistoryBuilder()
                .withRedis(new RedisSchemaHistoryStoreBuilder()
                        .withAddress(redisStoreConfig.connectionConfig().address())
                        .withUser(redisStoreConfig.connectionConfig().user())
                        .withPassword(redisStoreConfig.connectionConfig().password())
                        .withSslEnabled(redisStoreConfig.connectionConfig().sslEnabled())
                        .withKey(redisStoreConfig.key())
                        .withWait(new RedisStoreWaitConfigBuilder()
                                .withEnabled(redisStoreConfig.writeConfig().enabled())
                                .withTimeoutMs(redisStoreConfig.writeConfig().timeoutMs())
                                .withRetry(redisStoreConfig.writeConfig().retry())
                                .withRetryDelayMs(redisStoreConfig.writeConfig().retryDelayMs())
                                .build())
                        .build())
                .build();
    }

}
