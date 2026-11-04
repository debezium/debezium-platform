/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;

import io.debezium.config.Configuration;
import io.debezium.jdbc.JdbcConfiguration;
import io.debezium.jdbc.JdbcConnection;
import io.debezium.relational.SignalDataCollectionValidationRequest;
import io.debezium.relational.SignalDataCollectionValidator;
import io.debezium.relational.TableId;

@ApplicationScoped
public class SignalDataCollectionChecker {

    public boolean verifyTableStructure(Connection connection, String catalog, String schemaName, String tableName) throws SQLException {
        TableId table = new TableId(catalog, schemaName == null || schemaName.isEmpty() ? null : schemaName, tableName);

        try (JdbcConnection jdbcConnection = new JdbcConnection(JdbcConfiguration.adapt(Configuration.empty()), config -> connection, "\"", "\"")) {
            var request = new SignalDataCollectionValidationRequest(
                    List.of(table.toString()),
                    true, true, true, false,
                    raw -> jdbcConnection,
                    tableId -> tableId.table().equalsIgnoreCase(tableName),
                    (c, s, t, column) -> true);

            return SignalDataCollectionValidator.validate(request).isValid();
        }
    }
}
