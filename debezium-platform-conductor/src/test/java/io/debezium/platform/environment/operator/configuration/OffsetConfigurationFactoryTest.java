package io.debezium.platform.environment.operator.configuration;

import io.debezium.DebeziumException;
import io.debezium.operator.api.model.source.Offset;
import io.debezium.operator.api.model.source.storage.offset.ConfigMapOffsetStore;
import io.debezium.operator.api.model.source.storage.offset.FileOffsetStore;
import io.debezium.operator.api.model.source.storage.offset.InMemoryOffsetStore;
import io.debezium.operator.api.model.source.storage.offset.JdbcOffsetStore;
import io.debezium.operator.api.model.source.storage.offset.KafkaOffsetStore;
import io.debezium.operator.api.model.source.storage.offset.RedisOffsetStore;
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
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.Mockito.when;

/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
@ExtendWith(MockitoExtension.class)
class OffsetConfigurationFactoryTest {

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    private PipelineConfigGroup pipelineConfigGroup;

    @Mock
    private PipelineFlat pipelineFlat;

    @Test
    void jdbcOffset() {

        when(pipelineFlat.getName()).thenReturn("test-pipeline");
        when(pipelineConfigGroup.offset().storage().type()).thenReturn("io.debezium.storage.jdbc.offset.JdbcOffsetBackingStore");
        when(pipelineConfigGroup.offset().storage().config()).thenReturn(
                Map.of("jdbc.url", "jdbc:postgresql://localhost:5432/postgres",
                        "jdbc.user", "test",
                        "jdbc.password", "password"));

        OffsetConfigurationFactory offsetFactory = new OffsetConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        Offset offset = offsetFactory.create(pipelineFlat);

        assertThat(offset.getActiveStore()).isInstanceOf(JdbcOffsetStore.class);
        assertThat(offset.getJdbc().getTable().getName()).isEqualTo("test_pipeline_offset");
        assertThat(offset.getJdbc().getUrl()).isEqualTo("jdbc:postgresql://localhost:5432/postgres");
        assertThat(offset.getJdbc().getUser()).isEqualTo("test");
        assertThat(offset.getJdbc().getPassword()).isEqualTo("password");
    }

    @Test
    void memoryOffset() {

        when(pipelineConfigGroup.offset().storage().type()).thenReturn("org.apache.kafka.connect.storage.MemoryOffsetBackingStore");

        OffsetConfigurationFactory offsetFactory = new OffsetConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        Offset offset = offsetFactory.create(pipelineFlat);

        assertThat(offset.getActiveStore()).isInstanceOf(InMemoryOffsetStore.class);
    }

    @Test
    void fileOffset() {

        when(pipelineConfigGroup.offset().storage().type()).thenReturn("org.apache.kafka.connect.storage.FileOffsetBackingStore");
        when(pipelineConfigGroup.offset().storage().config()).thenReturn(Map.of("file.filename", "test-file"));

        OffsetConfigurationFactory offsetFactory = new OffsetConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        Offset offset = offsetFactory.create(pipelineFlat);

        assertThat(offset.getActiveStore()).isInstanceOf(FileOffsetStore.class);
        assertThat(offset.getFile().getFileName()).isEqualTo("test-file");
    }

    @Test
    void configMapOffset() {

        when(pipelineConfigGroup.offset().storage().type()).thenReturn("io.debezium.storage.configmap.ConfigMapOffsetStore");
        when(pipelineConfigGroup.offset().storage().config()).thenReturn(Map.of("configmap.name", "test_map"));

        OffsetConfigurationFactory offsetFactory = new OffsetConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        Offset offset = offsetFactory.create(pipelineFlat);

        assertThat(offset.getActiveStore()).isInstanceOf(ConfigMapOffsetStore.class);
        assertThat(offset.getConfigMap().getName()).isEqualTo("test_map");
    }

    @Test
    void kafkaMapOffset() {

        when(pipelineConfigGroup.offset().storage().type()).thenReturn("org.apache.kafka.connect.storage.KafkaOffsetBackingStore");
        when(pipelineConfigGroup.offset().storage().config()).thenReturn(
                Map.of("bootstrap.servers", "localhost:9092",
                        "topic", "offsets",
                        "partitions", "1",
                        "replication.factor", "2",
                        "client.id", "test-client"));

        OffsetConfigurationFactory offsetFactory = new OffsetConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        Offset offset = offsetFactory.create(pipelineFlat);

        assertThat(offset.getActiveStore()).isInstanceOf(KafkaOffsetStore.class);
        assertThat(offset.getKafka().getBootstrapServers()).isEqualTo("localhost:9092");
        assertThat(offset.getKafka().getTopic()).isEqualTo("offsets");
        assertThat(offset.getKafka().getPartitions()).isEqualTo(1);
        assertThat(offset.getKafka().getReplicationFactor()).isEqualTo(2);
        assertThat(offset.getKafka().getProps().getProps()).containsExactly(entry("client.id", "test-client"));
    }

    @Test
    void redisMapOffset() {

        when(pipelineConfigGroup.offset().storage().type()).thenReturn("io.debezium.storage.redis.offset.RedisOffsetBackingStore");
        when(pipelineConfigGroup.offset().storage().config()).thenReturn(
                Map.of("address", "localhost:6379",
                        "user", "user",
                        "password", "pwd",
                        "ssl.enabled", "true",
                        "key", "offsets",
                        "wait.enabled", "true",
                        "wait.timeout.ms", "100",
                        "wait.retry.enabled", "true",
                        "wait.retry.delay.ms", "200"));

        OffsetConfigurationFactory offsetFactory = new OffsetConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        Offset offset = offsetFactory.create(pipelineFlat);

        assertThat(offset.getActiveStore()).isInstanceOf(RedisOffsetStore.class);
        assertThat(offset.getRedis().getAddress()).isEqualTo("localhost:6379");
        assertThat(offset.getRedis().getUser()).isEqualTo("user");
        assertThat(offset.getRedis().getPassword()).isEqualTo("pwd");
        assertThat(offset.getRedis().getKey()).isEqualTo("offsets");
        assertThat(offset.getRedis().isSslEnabled()).isEqualTo(true);
        assertThat(offset.getRedis().getWait().isEnabled()).isEqualTo(true);
        assertThat(offset.getRedis().getWait().getTimeoutMs()).isEqualTo(100);
        assertThat(offset.getRedis().getWait().isRetry()).isEqualTo(true);
        assertThat(offset.getRedis().getWait().getRetryDelayMs()).isEqualTo(200);
    }

    @Test
    void unsupportedOffset() {

        when(pipelineConfigGroup.offset().storage().type()).thenReturn("io.custom.MyCustomOffset");

        OffsetConfigurationFactory offsetFactory = new OffsetConfigurationFactory(pipelineConfigGroup, new TableNameResolver());

        assertThatThrownBy(() -> offsetFactory.create(pipelineFlat))
                .isInstanceOf(DebeziumException.class)
                .hasMessage("Offset type io.custom.MyCustomOffset not supported");

    }
}