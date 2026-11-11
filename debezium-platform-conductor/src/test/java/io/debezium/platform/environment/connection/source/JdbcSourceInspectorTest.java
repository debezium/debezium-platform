/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import io.debezium.connector.mysql.jdbc.MySqlConnection;
import io.debezium.connector.postgresql.connection.PostgresConnection;
import io.debezium.platform.data.dto.CatalogNode;
import io.debezium.platform.data.dto.SignalDataCollectionVerifyResponse;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.actions.SignalDataCollectionChecker;
import io.debezium.platform.environment.connection.TestConnectionView;
import io.debezium.platform.environment.database.DatabaseConnectionFactory;
import io.debezium.relational.TableId;

class JdbcSourceInspectorTest {

    private DatabaseConnectionFactory databaseConnectionFactory;
    private SignalDataCollectionChecker signalDataCollectionChecker;
    private JdbcSourceInspector sourceInspector;

    @BeforeEach
    void setUp() {
        databaseConnectionFactory = mock(DatabaseConnectionFactory.class);
        signalDataCollectionChecker = mock(SignalDataCollectionChecker.class);
        sourceInspector = new JdbcSourceInspector(databaseConnectionFactory, signalDataCollectionChecker);
    }

    @ParameterizedTest(name = "Verifying a signal data collection named [{0}] is rejected without contacting the database")
    @NullSource
    @ValueSource(strings = { "", "   " })
    void shouldRejectMissingTableName(String fullyQualifiedTableName) {
        Connection connection = new TestConnectionView(ConnectionEntity.Type.POSTGRESQL, Map.of());

        SignalDataCollectionVerifyResponse response = sourceInspector.verifyDataCollectionStructure(connection, fullyQualifiedTableName);

        assertThat(response.exists()).isFalse();
        assertThat(response.message()).isEqualTo("A fully qualified signal data collection name is required");

        verifyNoInteractions(databaseConnectionFactory, signalDataCollectionChecker);
    }

    @Test
    void shouldListOnlyTheConfiguredMySqlDatabase() throws Exception {
        MySqlConnection jdbcConnection = mock(MySqlConnection.class);
        when(databaseConnectionFactory.create(any())).thenReturn(jdbcConnection);
        when(jdbcConnection.readTableNames("app", null, null, new String[]{ "TABLE" }))
                .thenReturn(Set.of(new TableId("app", null, "orders")));

        var tree = sourceInspector
                .listAvailableCollections(new TestConnectionView(ConnectionEntity.Type.MYSQL, Map.of("hostname", "mysql", "port", 3306, "database", "app")));

        assertThat(tree.catalogs()).extracting(CatalogNode::name).containsExactly("app");
        verify(jdbcConnection, never()).getAllTableIds(any());
    }

    @Test
    void shouldListEveryMySqlDatabaseWithoutConfiguredDatabase() throws Exception {
        MySqlConnection jdbcConnection = mock(MySqlConnection.class);
        when(databaseConnectionFactory.create(any())).thenReturn(jdbcConnection);
        when(jdbcConnection.getAllTableIds(null))
                .thenReturn(Set.of(new TableId("app", null, "orders"), new TableId("billing", null, "invoices")));

        var tree = sourceInspector.listAvailableCollections(new TestConnectionView(ConnectionEntity.Type.MYSQL, Map.of("hostname", "mysql", "port", 3306)));

        assertThat(tree.catalogs()).extracting(CatalogNode::name).containsExactlyInAnyOrder("app", "billing");
    }

    @Test
    void shouldListPostgresTablesOfTheConnectionDatabase() throws Exception {
        PostgresConnection jdbcConnection = mock(PostgresConnection.class);
        when(databaseConnectionFactory.create(any())).thenReturn(jdbcConnection);
        when(jdbcConnection.database()).thenReturn("inventory");
        when(jdbcConnection.getAllTableIds("inventory"))
                .thenReturn(Set.of(new TableId("inventory", "public", "orders")));

        var tree = sourceInspector.listAvailableCollections(
                new TestConnectionView(ConnectionEntity.Type.POSTGRESQL, Map.of("hostname", "postgres", "port", 5432, "database", "inventory")));

        assertThat(tree.catalogs()).extracting(CatalogNode::name).containsExactly("inventory");
        verify(jdbcConnection, never()).readTableNames(anyString(), any(), any(), any());
    }
}
