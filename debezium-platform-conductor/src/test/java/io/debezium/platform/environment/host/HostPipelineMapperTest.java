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

import io.debezium.operator.api.config.ConfigMapping;
import io.debezium.operator.api.model.DebeziumServer;
import io.debezium.platform.domain.views.flat.DestinationFlat;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.domain.views.flat.SourceFlat;
import io.debezium.platform.environment.operator.PipelineMapper;

/**
 * Unit tests for {@link HostPipelineMapper}.
 *
 * <p>Plain JUnit 5 tests with no {@code @QuarkusTest}. The operator's
 * {@link PipelineMapper} is mocked to return a known configuration map.
 *
 * <p>This verifies:
 * <ul>
 *   <li>Offset storage is overridden from JDBC to file-based</li>
 *   <li>Schema history is overridden from JDBC to file-based</li>
 *   <li>Original properties from operator mapper are preserved</li>
 *   <li>Deterministic key ordering (TreeMap)</li>
 *   <li>SHA-256 hash stability</li>
 * </ul>
 */
class HostPipelineMapperTest {

    private PipelineMapper operatorMapper;
    private HostPipelineMapper mapper;

    @BeforeEach
    void setUp() {
        operatorMapper = mock(PipelineMapper.class);
        mapper = new HostPipelineMapper(operatorMapper);
    }

    @Test
    void mapOverridesOffsetStorageToFileBased() {
        PipelineFlat pipeline = buildMinimalPipeline();
        stubOperatorMapper(pipeline, Map.of(
                "debezium.source.connector.class", "io.debezium.connector.postgresql.PostgresConnector",
                "debezium.source.offset.storage", "io.debezium.storage.jdbc.offset.JdbcOffsetBackingStore",
                "debezium.source.offset.storage.jdbc.connection.url", "jdbc:postgresql://localhost:5432/debezium",
                "debezium.source.offset.storage.jdbc.connection.user", "debezium",
                "debezium.source.offset.storage.jdbc.offset.table.name", "test_pipeline_offset",
                "debezium.sink.type", "kafka"));

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        assertThat(result.propertiesContent())
                .contains("debezium.source.offset.storage=org.apache.kafka.connect.storage.FileOffsetBackingStore")
                .contains("debezium.source.offset.storage.file.filename=/debezium/data/offsets.dat")
                // JDBC offset properties must be removed
                .doesNotContain("JdbcOffsetBackingStore")
                .doesNotContain("jdbc.connection.url")
                .doesNotContain("jdbc.offset.table.name");
    }

    @Test
    void mapOverridesSchemaHistoryToFileBased() {
        PipelineFlat pipeline = buildMinimalPipeline();
        stubOperatorMapper(pipeline, Map.of(
                "debezium.source.connector.class", "io.debezium.connector.postgresql.PostgresConnector",
                "debezium.source.schema.history.internal", "io.debezium.storage.jdbc.history.JdbcSchemaHistory",
                "debezium.source.schema.history.internal.jdbc.connection.url", "jdbc:postgresql://localhost:5432/debezium",
                "debezium.source.schema.history.internal.jdbc.schema.history.table.name", "test_pipeline_schema_history",
                "debezium.sink.type", "kafka"));

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        assertThat(result.propertiesContent())
                .contains("debezium.source.schema.history.internal=io.debezium.storage.file.history.FileSchemaHistory")
                .contains("debezium.source.schema.history.internal.file.filename=/debezium/data/schema-history.dat")
                // JDBC schema history properties must be removed
                .doesNotContain("JdbcSchemaHistory")
                .doesNotContain("jdbc.schema.history.table.name");
    }

    @Test
    void mapPreservesNonOverriddenProperties() {
        PipelineFlat pipeline = buildMinimalPipeline();
        stubOperatorMapper(pipeline, Map.of(
                "debezium.source.connector.class", "io.debezium.connector.postgresql.PostgresConnector",
                "debezium.source.database.hostname", "db.example.com",
                "debezium.source.database.port", "5432",
                "debezium.sink.type", "kafka",
                "debezium.sink.kafka.producer.bootstrap.servers", "kafka:9092",
                "debezium.format.key", "json",
                "debezium.format.value", "json"));

        HostPipelineMapper.MappedConfig result = mapper.map(pipeline);

        assertThat(result.propertiesContent())
                .contains("debezium.source.connector.class=io.debezium.connector.postgresql.PostgresConnector")
                .contains("debezium.source.database.hostname=db.example.com")
                .contains("debezium.source.database.port=5432")
                .contains("debezium.sink.type=kafka")
                .contains("debezium.sink.kafka.producer.bootstrap.servers=kafka:9092")
                .contains("debezium.format.key=json")
                .contains("debezium.format.value=json");
    }

    @Test
    void mapProducesDeterministicOutput() {
        PipelineFlat pipeline = buildMinimalPipeline();
        stubOperatorMapper(pipeline, Map.of(
                "debezium.source.connector.class", "io.debezium.connector.postgresql.PostgresConnector",
                "debezium.sink.type", "kafka"));

        HostPipelineMapper.MappedConfig first = mapper.map(pipeline);
        HostPipelineMapper.MappedConfig second = mapper.map(pipeline);

        assertThat(first.propertiesContent()).isEqualTo(second.propertiesContent());
    }

    @Test
    void mapProducesStableHash() {
        PipelineFlat pipeline = buildMinimalPipeline();
        stubOperatorMapper(pipeline, Map.of(
                "debezium.source.connector.class", "io.debezium.connector.postgresql.PostgresConnector",
                "debezium.sink.type", "kafka"));

        HostPipelineMapper.MappedConfig first = mapper.map(pipeline);
        HostPipelineMapper.MappedConfig second = mapper.map(pipeline);

        assertThat(first.configHash()).isEqualTo(second.configHash());
        assertThat(first.configHash()).hasSize(64); // SHA-256 = 32 bytes = 64 hex chars
    }

    @Test
    void computeConfigHashProducesConsistentOutput() {
        String content = "debezium.source.connector.class=test\ndebezium.sink.type=kafka";
        String hash1 = HostPipelineMapper.computeConfigHash(content);
        String hash2 = HostPipelineMapper.computeConfigHash(content);

        assertThat(hash1).isEqualTo(hash2);
        assertThat(hash1).hasSize(64);
    }

    // ── Helpers ──

    @SuppressWarnings("unchecked")
    private void stubOperatorMapper(PipelineFlat pipeline, Map<String, String> configMap) {
        DebeziumServer debeziumServer = mock(DebeziumServer.class);
        ConfigMapping<DebeziumServer> configMapping = mock(ConfigMapping.class);
        when(configMapping.getAsMapSimple()).thenReturn(configMap);
        when(debeziumServer.asConfiguration()).thenReturn(configMapping);
        when(operatorMapper.map(pipeline)).thenReturn(debeziumServer);
    }

    private PipelineFlat buildMinimalPipeline() {
        SourceFlat source = mock(SourceFlat.class);
        when(source.getType()).thenReturn("io.debezium.connector.postgresql.PostgresConnector");
        when(source.getConfig()).thenReturn(Collections.emptyMap());

        DestinationFlat destination = mock(DestinationFlat.class);
        when(destination.getType()).thenReturn("io.debezium.server.kafka.KafkaChangeConsumer");
        when(destination.getConfig()).thenReturn(Collections.emptyMap());

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
