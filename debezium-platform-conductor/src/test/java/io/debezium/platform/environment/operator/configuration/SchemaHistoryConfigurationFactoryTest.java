package io.debezium.platform.environment.operator.configuration;

import io.debezium.DebeziumException;
import io.debezium.operator.api.model.source.SchemaHistory;
import io.debezium.operator.api.model.source.storage.schema.FileSchemaHistoryStore;
import io.debezium.operator.api.model.source.storage.schema.InMemorySchemaHistoryStore;
import io.debezium.operator.api.model.source.storage.schema.JdbcSchemaHistoryStore;
import io.debezium.operator.api.model.source.storage.schema.KafkaSchemaHistoryStore;
import io.debezium.operator.api.model.source.storage.schema.RedisSchemaHistoryStore;
import io.debezium.platform.config.PipelineConfigGroup;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
@ExtendWith(MockitoExtension.class)
class SchemaHistoryConfigurationFactoryTest {

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    private PipelineConfigGroup pipelineConfigGroup;

    @Mock
    private PipelineFlat pipelineFlat;

    @Test
    void jdbcSchemaHistory() {

        when(pipelineFlat.getName()).thenReturn("test-pipeline");
        when(pipelineConfigGroup.schema().internal()).thenReturn("io.debezium.storage.jdbc.history.JdbcSchemaHistory");
        when(pipelineConfigGroup.schema().config()).thenReturn(
                Map.of("jdbc.url", "jdbc:postgresql://localhost:5432/postgres",
                        "jdbc.user", "test",
                        "jdbc.password", "password"));

        SchemaHistoryConfigurationFactory offsetFactory = new SchemaHistoryConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        SchemaHistory schemaHistory = offsetFactory.create(pipelineFlat);

        assertThat(schemaHistory.getActiveStore()).isInstanceOf(JdbcSchemaHistoryStore.class);
        assertThat(schemaHistory.getJdbc().getTable().getName()).isEqualTo("test_pipeline_schema_history");
        assertThat(schemaHistory.getJdbc().getUrl()).isEqualTo("jdbc:postgresql://localhost:5432/postgres");
        assertThat(schemaHistory.getJdbc().getUser()).isEqualTo("test");
        assertThat(schemaHistory.getJdbc().getPassword()).isEqualTo("password");
    }

    @Test
    void memorySchemaHistory() {

        when(pipelineConfigGroup.schema().internal()).thenReturn("io.debezium.relational.history.MemorySchemaHistory");

        SchemaHistoryConfigurationFactory offsetFactory = new SchemaHistoryConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        SchemaHistory schemaHistory = offsetFactory.create(pipelineFlat);

        assertThat(schemaHistory.getActiveStore()).isInstanceOf(InMemorySchemaHistoryStore.class);
    }

    @Test
    void fileSchemaHistory() {

        when(pipelineConfigGroup.schema().internal()).thenReturn("io.debezium.storage.file.history.FileSchemaHistory");
        when(pipelineConfigGroup.schema().config()).thenReturn(Map.of("file.filename", "test-file"));

        SchemaHistoryConfigurationFactory offsetFactory = new SchemaHistoryConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        SchemaHistory schemaHistory = offsetFactory.create(pipelineFlat);

        assertThat(schemaHistory.getActiveStore()).isInstanceOf(FileSchemaHistoryStore.class);
        assertThat(schemaHistory.getFile().getFileName()).isEqualTo("test-file");
    }

    @Test
    void kafkaMapSchemaHistory() {

        when(pipelineConfigGroup.schema().internal()).thenReturn("io.debezium.storage.kafka.history.KafkaSchemaHistory");
        when(pipelineConfigGroup.schema().config()).thenReturn(
                Map.of("bootstrap.servers", "localhost:9092",
                        "topic", "offsets",
                        "partitions", "1",
                        "replication.factor", "2"));

        SchemaHistoryConfigurationFactory offsetFactory = new SchemaHistoryConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        SchemaHistory schemaHistory = offsetFactory.create(pipelineFlat);

        assertThat(schemaHistory.getActiveStore()).isInstanceOf(KafkaSchemaHistoryStore.class);
        assertThat(schemaHistory.getKafka().getBootstrapServers()).isEqualTo("localhost:9092");
        assertThat(schemaHistory.getKafka().getTopic()).isEqualTo("offsets");
        assertThat(schemaHistory.getKafka().getPartitions()).isEqualTo(1);
        assertThat(schemaHistory.getKafka().getReplicationFactor()).isEqualTo(2);
    }

    @Test
    void redisMapSchemaHistory() {

        when(pipelineConfigGroup.schema().internal()).thenReturn("io.debezium.storage.redis.history.RedisSchemaHistory");
        when(pipelineConfigGroup.schema().config()).thenReturn(
                Map.of("address", "localhost:6379",
                        "user", "user",
                        "password", "pwd",
                        "ssl.enabled", "true",
                        "key", "offsets",
                        "wait.enabled", "true",
                        "wait.timeout.ms", "100",
                        "wait.retry.enabled", "true",
                        "wait.retry.delay.ms", "200"));

        SchemaHistoryConfigurationFactory offsetFactory = new SchemaHistoryConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        SchemaHistory schemaHistory = offsetFactory.create(pipelineFlat);

        assertThat(schemaHistory.getActiveStore()).isInstanceOf(RedisSchemaHistoryStore.class);
        assertThat(schemaHistory.getRedis().getAddress()).isEqualTo("localhost:6379");
        assertThat(schemaHistory.getRedis().getUser()).isEqualTo("user");
        assertThat(schemaHistory.getRedis().getPassword()).isEqualTo("pwd");
        assertThat(schemaHistory.getRedis().getKey()).isEqualTo("offsets");
        assertThat(schemaHistory.getRedis().isSslEnabled()).isEqualTo(true);
        assertThat(schemaHistory.getRedis().getWait().isEnabled()).isEqualTo(true);
        assertThat(schemaHistory.getRedis().getWait().getTimeoutMs()).isEqualTo(100);
        assertThat(schemaHistory.getRedis().getWait().isRetry()).isEqualTo(true);
        assertThat(schemaHistory.getRedis().getWait().getRetryDelayMs()).isEqualTo(200);
    }

    @Test
    void unsupportedSchemaHistory() {

        when(pipelineConfigGroup.schema().internal()).thenReturn("io.custom.MyCustomOffset");

        SchemaHistoryConfigurationFactory offsetFactory = new SchemaHistoryConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        assertThatThrownBy(() -> offsetFactory.create(pipelineFlat))
                .isInstanceOf(DebeziumException.class)
                .hasMessage("Schema history io.custom.MyCustomOffset not supported");

    }
}