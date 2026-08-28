/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import io.debezium.platform.data.dto.SignalDataCollectionVerifyResponse;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.actions.SignalDataCollectionChecker;
import io.debezium.platform.environment.connection.TestConnectionView;
import io.debezium.platform.environment.database.DatabaseConnectionFactory;

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
}
