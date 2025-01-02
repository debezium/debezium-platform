/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.configuration;

import io.debezium.DebeziumException;
import io.debezium.operator.api.model.ConfigProperties;
import io.debezium.operator.api.model.source.Offset;
import io.debezium.operator.api.model.source.OffsetBuilder;
import io.debezium.operator.api.model.source.storage.RedisStoreWaitConfig;
import io.debezium.operator.api.model.source.storage.RedisStoreWaitConfigBuilder;
import io.debezium.operator.api.model.source.storage.offset.ConfigMapOffsetStoreBuilder;
import io.debezium.operator.api.model.source.storage.offset.FileOffsetStoreBuilder;
import io.debezium.operator.api.model.source.storage.offset.InMemoryOffsetStore;
import io.debezium.operator.api.model.source.storage.offset.JdbcOffsetStoreBuilder;
import io.debezium.operator.api.model.source.storage.offset.JdbcOffsetTableConfigBuilder;
import io.debezium.operator.api.model.source.storage.offset.KafkaOffsetStoreBuilder;
import io.debezium.operator.api.model.source.storage.offset.RedisOffsetStoreBuilder;
import io.debezium.platform.config.PipelineConfigGroup;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.operator.configuration.common.KafkaStoreConfig;
import io.debezium.platform.environment.operator.configuration.common.RedisStoreConfig;
import io.debezium.storage.jdbc.JdbcCommonConfig;
import jakarta.enterprise.context.Dependent;

import java.util.HashMap;
import java.util.Map;

@Dependent
public class OffsetConfigurationFactory {

    private static final String JDBC = "io.debezium.storage.jdbc.offset.JdbcOffsetBackingStore";
    private static final String FILE = "org.apache.kafka.connect.storage.FileOffsetBackingStore";
    private static final String IN_MEMORY = "org.apache.kafka.connect.storage.MemoryOffsetBackingStore";
    private static final String CONFIG_MAP = "io.debezium.storage.configmap.ConfigMapOffsetStore";
    private static final String KAFKA = "org.apache.kafka.connect.storage.KafkaOffsetBackingStore";
    private static final String REDIS = "io.debezium.storage.redis.offset.RedisOffsetBackingStore";

    private static final String OFFSET_SUFFIX = "offset";
    private static final String FILE_OFFSET_STORE_FILE_FILENAME_CONFIG = "file.filename";

    private final PipelineConfigGroup pipelineConfigGroup;
    private final TableNameResolver tableNameResolver;

    public OffsetConfigurationFactory(PipelineConfigGroup pipelineConfigGroup, TableNameResolver tableNameResolver) {

        this.pipelineConfigGroup = pipelineConfigGroup;
        this.tableNameResolver = tableNameResolver;
    }

    public Offset create(PipelineFlat pipeline) {

        var pipelineOffsetConfigs = pipelineConfigGroup.offset().storage().config();
        var type = pipelineConfigGroup.offset().storage().type();
        return switch (type) {
            case JDBC -> buildJdbcConfigs(pipeline, pipelineOffsetConfigs);
            case FILE -> buildFileConfigs(pipelineOffsetConfigs);
            case IN_MEMORY -> new OffsetBuilder().withMemory(new InMemoryOffsetStore()).build();
            case CONFIG_MAP -> buildConfigMapConfigs(pipelineOffsetConfigs);
            case KAFKA -> buildKafkaConfigs(pipelineOffsetConfigs);
            case REDIS -> buildRedisConfigs(pipelineOffsetConfigs);
            default -> throw new DebeziumException(String.format("Offset type %s not supported", type));
        };
    }

    private Offset buildRedisConfigs(Map<String, String> pipelineOffsetConfigs) {

        RedisStoreConfig redisStoreConfig = RedisStoreConfig.from(pipelineOffsetConfigs);
        RedisStoreWaitConfigBuilder redisStoreWaitConfigBuilder = new RedisStoreWaitConfigBuilder()
                .withEnabled(redisStoreConfig.writeConfig().enabled())
                .withRetry(redisStoreConfig.writeConfig().retry());

        if(redisStoreConfig.writeConfig().timeoutMs() != null) {
            redisStoreWaitConfigBuilder.withTimeoutMs(redisStoreConfig.writeConfig().timeoutMs());
        }

        if(redisStoreConfig.writeConfig().retryDelayMs() != null) {
            redisStoreWaitConfigBuilder.withRetryDelayMs(redisStoreConfig.writeConfig().retryDelayMs());
        }

        RedisStoreWaitConfig redisStoreWaitConfig = redisStoreWaitConfigBuilder.build();

        return new OffsetBuilder()
                .withRedis(new RedisOffsetStoreBuilder()
                        .withAddress(redisStoreConfig.connectionConfig().address())
                        .withUser(redisStoreConfig.connectionConfig().user())
                        .withPassword(redisStoreConfig.connectionConfig().password())
                        .withSslEnabled(redisStoreConfig.connectionConfig().sslEnabled())
                        .withKey(redisStoreConfig.key())
                        .withWait(redisStoreWaitConfig)
                        .build())
                .build();
    }

    private Offset buildKafkaConfigs(Map<String, String> pipelineOffsetConfigs) {

        Map<String, String> kafkaOffsetConfigs = new HashMap<>(pipelineOffsetConfigs);
        KafkaStoreConfig kafkaStoreConfig = KafkaStoreConfig.from(kafkaOffsetConfigs);
        kafkaOffsetConfigs.remove(KafkaStoreConfig.KAFKA_STORE_BOOTSTRAP_SERVERS);
        kafkaOffsetConfigs.remove(KafkaStoreConfig.KAFKA_STORE_TOPIC);
        kafkaOffsetConfigs.remove(KafkaStoreConfig.KAFKA_STORE_PARTITIONS);
        kafkaOffsetConfigs.remove(KafkaStoreConfig.KAFKA_STORE_REPLICATION_FACTOR);

        ConfigProperties additionalProps = new ConfigProperties();
        kafkaOffsetConfigs.forEach(additionalProps::setProps);

        return new OffsetBuilder()
                .withKafka(new KafkaOffsetStoreBuilder()
                        .withBootstrapServers(kafkaStoreConfig.bootstrapServers())
                        .withTopic(kafkaStoreConfig.topic())
                        .withPartitions(kafkaStoreConfig.partitions())
                        .withReplicationFactor(kafkaStoreConfig.replicationFactor())
                        .withProps(additionalProps)
                        .build()
                ).build();
    }

    private Offset buildConfigMapConfigs(Map<String, String> pipelineOffsetConfigs) {

        return new OffsetBuilder()
                .withConfigMap(new ConfigMapOffsetStoreBuilder()
                        .withName(pipelineOffsetConfigs.get("configmap.name"))
                        .build())
                .build();
    }

    private Offset buildFileConfigs(Map<String, String> pipelineOffsetConfigs) {

        return new OffsetBuilder()
                .withFile(new FileOffsetStoreBuilder()
                        .withFileName(pipelineOffsetConfigs.get(FILE_OFFSET_STORE_FILE_FILENAME_CONFIG))
                        .build())
                .build();
    }

    private Offset buildJdbcConfigs(PipelineFlat pipeline, Map<String, String> pipelineOffsetConfigs) {

        return new OffsetBuilder()
                .withJdbc(new JdbcOffsetStoreBuilder()
                        .withUrl(pipelineOffsetConfigs.get(JdbcCommonConfig.PROP_JDBC_URL.name()))
                        .withUser(pipelineOffsetConfigs.get(JdbcCommonConfig.PROP_USER.name()))
                        .withPassword(pipelineOffsetConfigs.get(JdbcCommonConfig.PROP_PASSWORD.name()))
                        .withTable(new JdbcOffsetTableConfigBuilder()
                                .withName(tableNameResolver.resolve(pipeline, OFFSET_SUFFIX))
                                .build())
                        .build()
                )
                .build();
    }
}
