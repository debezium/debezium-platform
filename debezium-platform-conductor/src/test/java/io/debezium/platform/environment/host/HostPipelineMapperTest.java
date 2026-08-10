/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.debezium.platform.config.OffsetConfigGroup;
import io.debezium.platform.config.OffsetStorageConfigGroup;
import io.debezium.platform.config.PipelineConfigGroup;
import io.debezium.platform.config.SchemaHistoryConfigGroup;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.domain.views.flat.DestinationFlat;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.domain.views.flat.SourceFlat;
import io.debezium.platform.environment.operator.configuration.TableNameResolver;

/**
 * Unit tests for {@link HostPipelineMapper}.
 *
 * <p>Plain JUnit 5 tests with no {@code @QuarkusTest}. The
 * {@link PipelineConfigGroup} and {@link PipelineFlat} are mocked
 * directly. This verifies:
 * <ul>
 *   <li>Source connector class mapping</li>
 *   <li>Source connection config with prefix resolution</li>
 *   <li>Sink type resolution (FQCN to short name)</li>
 *   <li>Offset and schema history config embedding</li>
 *   <li>Deterministic key ordering (TreeMap)</li>
 *   <li>SHA-256 hash stability</li>
 *   <li>Signal and notification channel defaults</li>
 * </ul>
 */
class HostPipelineMapperTest {

    private PipelineConfigGroup pipelineConfigGroup;
    private TableNameResolver tableNameResolver;
    private HostPipelineMapper mapper;

    @BeforeEach
    void setUp() {
        pipelineConfigGroup = mock(PipelineConfigGroup.class);
        tableNameResolver = new TableNameResolver();

        // Wire offset storage config
        OffsetStorageConfigGroup offsetStorage = mock(OffsetStorageConfigGroup.class);
        when(offsetStorage.type()).thenReturn("io.debezium.storage.jdbc.offset.JdbcOffsetBackingStore");
        when(offsetStorage.config()).thenReturn(Map.of(
                "jdbc.connection.url", "jdbc:postgresql://localhost:5432/debezium",
                "jdbc.connection.user", "debezium",
                "jdbc.connection.password", "debezium",
                "jdbc.offset.table.name", "@{pipeline_name}_offset"));

        OffsetConfigGroup offsetConfig = mock(OffsetConfigGroup.class);
        when(offsetConfig.storage()).thenReturn(offsetStorage);
        when(pipelineConfigGroup.offset()).thenReturn(offsetConfig);

        // Wire schema history config
        SchemaHistoryConfigGroup schemaConfig = mock(SchemaHistoryConfigGroup.class);
        when(schemaConfig.internal()).thenReturn("io.debezium.storage.jdbc.history.JdbcSchemaHistory");
        when(schemaConfig.config()).thenReturn(Map.of(
                "jdbc.connection.url", "jdbc:postgresql://localhost:5432/debezium",
                "jdbc.connection.user", "debezium",
                "jdbc.connection.password", "debezium",
                "jdbc.schema.history.table.name", "@{pipeline_name}_schema_history"));

        when(pipelineConfigGroup.schema()).thenReturn(schemaConfig);

        mapper = new HostPipelineMapper(pipelineConfigGroup, tableNameResolver);
    }

    @Test
    void mapProducesSourceConnectorClass() {
        PipelineFlat pipeline = buildMinimalPipeline();

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        assertThat(result.propertiesContent())
                .contains("debezium.source.connector.class=io.debezium.connector.postgresql.PostgresConnector");
    }

    @Test
    void mapProducesSourceConnectionConfigWithDatabasePrefix() {
        PipelineFlat pipeline = buildMinimalPipeline();

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        assertThat(result.propertiesContent())
                .contains("debezium.source.database.hostname=db.example.com")
                .contains("debezium.source.database.port=5432");
    }

    @Test
    void mapResolvesSinkFqcnToShortName() {
        PipelineFlat pipeline = buildMinimalPipeline();

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        assertThat(result.propertiesContent())
                .contains("debezium.sink.type=kafka");
    }

    @Test
    void mapProducesSinkConnectionConfigWithProducerPrefix() {
        PipelineFlat pipeline = buildMinimalPipeline();

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        assertThat(result.propertiesContent())
                .contains("debezium.sink.kafka.producer.bootstrap.servers=kafka:9092");
    }

    @Test
    void mapIncludesOffsetStorageConfig() {
        PipelineFlat pipeline = buildMinimalPipeline();

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        assertThat(result.propertiesContent())
                .contains("debezium.source.offset.storage=io.debezium.storage.jdbc.offset.JdbcOffsetBackingStore")
                .contains("debezium.source.offset.storage.jdbc.connection.url=jdbc:postgresql://localhost:5432/debezium");
    }

    @Test
    void mapResolvesTableNamePlaceholders() {
        PipelineFlat pipeline = buildMinimalPipeline();

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        // @{pipeline_name} should be resolved to the pipeline name "test-pipeline"
        assertThat(result.propertiesContent())
                .contains("debezium.source.offset.storage.jdbc.offset.table.name=test_pipeline_offset");
    }

    @Test
    void mapIncludesSchemaHistoryConfig() {
        PipelineFlat pipeline = buildMinimalPipeline();

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        assertThat(result.propertiesContent())
                .contains("debezium.source.schema.history.internal=io.debezium.storage.jdbc.history.JdbcSchemaHistory")
                .contains("debezium.source.schema.history.internal.jdbc.connection.url=jdbc:postgresql://localhost:5432/debezium");
    }

    @Test
    void mapIncludesSignalAndNotificationDefaults() {
        PipelineFlat pipeline = buildMinimalPipeline();

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        assertThat(result.propertiesContent())
                .contains("debezium.source.signal.enabled.channels=source,in-process")
                .contains("debezium.source.notification.enabled.channels=log");
    }

    @Test
    void mapDefaultsOverrideUserSignalConfig() {
        // Build a pipeline where the user explicitly sets a custom signal channel
        Connection sourceConnection = mock(Connection.class);
        when(sourceConnection.getType()).thenReturn(ConnectionEntity.Type.POSTGRESQL);
        when(sourceConnection.getConfig()).thenReturn(Map.of(
                "hostname", "db.example.com",
                "port", 5432));

        SourceFlat source = mock(SourceFlat.class);
        when(source.getType()).thenReturn("io.debezium.connector.postgresql.PostgresConnector");
        when(source.getConnection()).thenReturn(sourceConnection);
        // User tries to override the signal channels
        when(source.getConfig()).thenReturn(Map.of(
                "signal.enabled.channels", "source,in-process,jmx",
                "notification.enabled.channels", "jmx"));

        Connection sinkConnection = mock(Connection.class);
        when(sinkConnection.getType()).thenReturn(ConnectionEntity.Type.KAFKA);
        when(sinkConnection.getConfig()).thenReturn(Map.of("bootstrap.servers", "kafka:9092"));

        DestinationFlat destination = mock(DestinationFlat.class);
        when(destination.getType()).thenReturn("io.debezium.server.kafka.KafkaChangeConsumer");
        when(destination.getConnection()).thenReturn(sinkConnection);
        when(destination.getConfig()).thenReturn(Collections.emptyMap());

        PipelineFlat pipeline = mock(PipelineFlat.class);
        when(pipeline.getId()).thenReturn(99L);
        when(pipeline.getName()).thenReturn("override-test");
        when(pipeline.getSource()).thenReturn(source);
        when(pipeline.getDestination()).thenReturn(destination);
        when(pipeline.getTransforms()).thenReturn(List.of());
        when(pipeline.getDefaultLogLevel()).thenReturn("INFO");
        when(pipeline.getLogLevels()).thenReturn(Collections.emptyMap());

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        // Platform defaults must ALWAYS win — user cannot override these
        assertThat(result.propertiesContent())
                .contains("debezium.source.signal.enabled.channels=source,in-process")
                .contains("debezium.source.notification.enabled.channels=log")
                .doesNotContain("jmx");
    }

    @Test
    void mapIncludesQuarkusLogging() {
        PipelineFlat pipeline = buildMinimalPipeline();

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        assertThat(result.propertiesContent())
                .contains("quarkus.log.level=INFO")
                .contains("quarkus.log.min-level=TRACE")
                .contains("quarkus.log.console.json=false");
    }

    @Test
    void mapProducesDeterministicOutput() {
        PipelineFlat pipeline = buildMinimalPipeline();

        HostPipelineMapper.MappedConfig first = mapper.map(pipeline);
        HostPipelineMapper.MappedConfig second = mapper.map(pipeline);

        assertThat(first.propertiesContent()).isEqualTo(second.propertiesContent());
    }

    @Test
    void mapProducesStableHash() {
        PipelineFlat pipeline = buildMinimalPipeline();

        HostPipelineMapper.MappedConfig first = mapper.map(pipeline);
        HostPipelineMapper.MappedConfig second = mapper.map(pipeline);

        assertThat(first.configHash()).isEqualTo(second.configHash());
        assertThat(first.configHash()).hasSize(64); // SHA-256 = 32 bytes = 64 hex chars
    }

    @Test
    void resolveSinkTypeHandlesKnownOverrides() {
        assertThat(HostPipelineMapper.resolveSinkType(
                "io.debezium.server.pubsub.PubSubLiteChangeConsumer")).isEqualTo("pubsublite");
        assertThat(HostPipelineMapper.resolveSinkType(
                "io.debezium.server.nats.jetstream.NatsJetStreamChangeConsumer")).isEqualTo("nats-jetstream");
    }

    @Test
    void resolveSinkTypeHandlesStandardFqcn() {
        assertThat(HostPipelineMapper.resolveSinkType(
                "io.debezium.server.kafka.KafkaChangeConsumer")).isEqualTo("kafka");
        assertThat(HostPipelineMapper.resolveSinkType(
                "io.debezium.server.kinesis.KinesisChangeConsumer")).isEqualTo("kinesis");
    }

    @Test
    void resolveSinkTypePassesThroughShortNames() {
        assertThat(HostPipelineMapper.resolveSinkType("kafka")).isEqualTo("kafka");
        assertThat(HostPipelineMapper.resolveSinkType(null)).isNull();
    }

    @Test
    void computeConfigHashProducesConsistentOutput() {
        String content = "debezium.source.connector.class=test\ndebezium.sink.type=kafka";
        String hash1 = HostPipelineMapper.computeConfigHash(content);
        String hash2 = HostPipelineMapper.computeConfigHash(content);

        assertThat(hash1).isEqualTo(hash2);
        assertThat(hash1).hasSize(64);
    }

    // ── Helper: build a minimal PipelineFlat mock ──

    private PipelineFlat buildMinimalPipeline() {
        // Source connection
        Connection sourceConnection = mock(Connection.class);
        when(sourceConnection.getType()).thenReturn(ConnectionEntity.Type.POSTGRESQL);
        when(sourceConnection.getConfig()).thenReturn(Map.of(
                "hostname", "db.example.com",
                "port", 5432,
                "username", "admin",
                "password", "secret",
                "database", "mydb"));

        // Source
        SourceFlat source = mock(SourceFlat.class);
        when(source.getType()).thenReturn("io.debezium.connector.postgresql.PostgresConnector");
        when(source.getConnection()).thenReturn(sourceConnection);
        when(source.getConfig()).thenReturn(Map.of("topic.prefix", "test-topic"));

        // Sink connection
        Connection sinkConnection = mock(Connection.class);
        when(sinkConnection.getType()).thenReturn(ConnectionEntity.Type.KAFKA);
        when(sinkConnection.getConfig()).thenReturn(Map.of(
                "bootstrap.servers", "kafka:9092"));

        // Sink
        DestinationFlat destination = mock(DestinationFlat.class);
        when(destination.getType()).thenReturn("io.debezium.server.kafka.KafkaChangeConsumer");
        when(destination.getConnection()).thenReturn(sinkConnection);
        when(destination.getConfig()).thenReturn(Collections.emptyMap());

        // Pipeline
        PipelineFlat pipeline = mock(PipelineFlat.class);
        when(pipeline.getId()).thenReturn(1L);
        when(pipeline.getName()).thenReturn("test-pipeline");
        when(pipeline.getSource()).thenReturn(source);
        when(pipeline.getDestination()).thenReturn(destination);
        when(pipeline.getTransforms()).thenReturn(List.of());
        when(pipeline.getDefaultLogLevel()).thenReturn("INFO");
        when(pipeline.getLogLevels()).thenReturn(Collections.emptyMap());

        return pipeline;
    }
}
