/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator;

import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DATABASE;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.USERNAME;
import static io.debezium.platform.environment.operator.OperatorPipelineController.LABEL_DBZ_CONDUCTOR_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.debezium.platform.config.PipelineConfigGroup;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.domain.views.flat.DestinationFlat;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.domain.views.flat.SourceFlat;
import io.debezium.platform.environment.operator.configuration.TableNameResolver;

@ExtendWith(MockitoExtension.class)
public class PipelineMapperTest {

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    PipelineConfigGroup pipelineConfigGroup;

    @Mock
    TableNameResolver tableNameResolver;

    private PipelineMapper pipelineMapper;

    @BeforeEach
    void setUp() {

        when(tableNameResolver.resolve(any(), any())).thenAnswer(invocation -> invocation.getArgument(1));
        when(pipelineConfigGroup.labels()).thenReturn(Map.of());

        pipelineMapper = new PipelineMapper(pipelineConfigGroup, tableNameResolver);
    }

    @Test
    public void testMapper_ShouldUseNamesForSqlServer() {
        var pipeline = mockPipelineWithSource(ConnectionEntity.Type.SQLSERVER, Map.of(
                DATABASE, "customers",
                USERNAME, "sa"));

        var result = pipelineMapper.map(pipeline);

        assertThat(result.getSpec().getSource().getConfig().getProps())
                .containsEntry("database.names", "customers")
                .containsEntry("database.user", "sa");
    }

    @Test
    public void testMapper_ShouldUseDbNameForPostgreSql() {
        var pipeline = mockPipelineWithSource(ConnectionEntity.Type.POSTGRESQL, Map.of(
                DATABASE, "customers",
                USERNAME, "sa"));

        var result = pipelineMapper.map(pipeline);

        assertThat(result.getSpec().getSource().getConfig().getProps())
                .containsEntry("database.dbname", "customers")
                .containsEntry("database.user", "sa");
    }

    @Test
    public void testMapper_ShouldMergeConfiguredLabelsWithConductorLabel() {
        when(pipelineConfigGroup.labels()).thenReturn(Map.of("argocd.argoproj.io/instance", "debezium-platform"));

        var pipeline = mockPipelineWithSource(ConnectionEntity.Type.POSTGRESQL, Map.of(
                DATABASE, "customers",
                USERNAME, "sa"));
        when(pipeline.getName()).thenReturn("pipeline-a");

        var result = pipelineMapper.map(pipeline);

        assertThat(result.getMetadata().getLabels())
                .containsEntry("argocd.argoproj.io/instance", "debezium-platform")
                .containsEntry(LABEL_DBZ_CONDUCTOR_ID, "1");
    }

    private PipelineFlat mockPipelineWithSource(ConnectionEntity.Type type, Map<String, Object> connectionConfig) {
        var pipeline = mock(PipelineFlat.class);
        var source = mock(SourceFlat.class);
        var destination = mock(DestinationFlat.class);
        var connection = mock(Connection.class);

        when(connection.getType()).thenReturn(type);
        when(connection.getConfig()).thenReturn(connectionConfig);

        when(source.getConnection()).thenReturn(connection);

        when(pipeline.getSource()).thenReturn(source);
        when(pipeline.getDestination()).thenReturn(destination);
        when(pipeline.getDefaultLogLevel()).thenReturn("INFO");
        when(pipeline.getLogLevels()).thenReturn(Map.of());
        when(pipeline.getId()).thenReturn(1L);

        return pipeline;
    }
}
