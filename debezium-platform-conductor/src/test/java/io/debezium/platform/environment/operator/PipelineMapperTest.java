/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator;

import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DATABASE;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DEBEZIUM_DATABASE_NAME_CONFIG;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DEBEZIUM_DATABASE_USERNAME_CONFIG;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.DEBEZIUM_SQLSERVER_DATABASE_NAME_CONFIG;
import static io.debezium.platform.environment.database.DatabaseConnectionConfiguration.USERNAME;
import static io.debezium.platform.environment.database.DatabaseConnectionFactory.DATABASE_CONNECTION_CONFIGURATION_PREFIX;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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

@ExtendWith(MockitoExtension.class)
public class PipelineMapperTest {

    @Mock
    PipelineConfigGroup pipelineConfigGroup;

    @Mock
    TableNameResolver tableNameResolver;

    @Mock
    private OffsetConfigGroup offsetConfigGroup;

    @Mock
    private OffsetStorageConfigGroup offsetStorageConfigGroup;

    @Mock
    private SchemaHistoryConfigGroup schemaHistoryConfigGroup;

    private PipelineMapper pipelineMapper;

    @BeforeEach
    void setUp() {
        when(pipelineConfigGroup.offset()).thenReturn(offsetConfigGroup);
        when(offsetConfigGroup.storage()).thenReturn(offsetStorageConfigGroup);
        when(pipelineConfigGroup.schema()).thenReturn(schemaHistoryConfigGroup);
        when(tableNameResolver.resolve(any(), any())).thenAnswer(invocation -> invocation.getArgument(1));

        pipelineMapper = new PipelineMapper(pipelineConfigGroup, tableNameResolver);
    }

    @Test
    public void testMapper_ShouldUseNamesForSqlServer() {
        var pipeline = mockPipelineWithSource(ConnectionEntity.Type.SQLSERVER, Map.of(
                DATABASE, "customers",
                USERNAME, "sa"));

        var result = pipelineMapper.map(pipeline);

        assertThat(result.getSpec().getSource().getConfig().getProps())
                .containsEntry(DATABASE_CONNECTION_CONFIGURATION_PREFIX + DEBEZIUM_SQLSERVER_DATABASE_NAME_CONFIG, "customers")
                .containsEntry(DATABASE_CONNECTION_CONFIGURATION_PREFIX + DEBEZIUM_DATABASE_USERNAME_CONFIG, "sa");
    }

    @Test
    public void testMapper_ShouldUseDbNameForPostgreSql() {
        var pipeline = mockPipelineWithSource(ConnectionEntity.Type.POSTGRESQL, Map.of(
                DATABASE, "customers",
                USERNAME, "sa"));

        var result = pipelineMapper.map(pipeline);

        assertThat(result.getSpec().getSource().getConfig().getProps())
                .containsEntry(DATABASE_CONNECTION_CONFIGURATION_PREFIX + DEBEZIUM_DATABASE_NAME_CONFIG, "customers")
                .containsEntry(DATABASE_CONNECTION_CONFIGURATION_PREFIX + DEBEZIUM_DATABASE_USERNAME_CONFIG, "sa");
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
