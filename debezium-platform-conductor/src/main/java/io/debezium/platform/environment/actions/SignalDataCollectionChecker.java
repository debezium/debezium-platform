/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions;

import java.sql.Connection;
import java.sql.Types;
import java.util.Map;
import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.environment.database.DatabaseInspector;

@ApplicationScoped
public class SignalDataCollectionChecker {

    private static final Logger LOGGER = LoggerFactory.getLogger(SignalDataCollectionChecker.class);

    private static final Map<String, DatabaseInspector.ColumnMetadata> EXPECTED_COLUMN_METADATA = Map.of(
            "id", new DatabaseInspector.ColumnMetadata("id", Types.VARCHAR, 42, false),
            "type", new DatabaseInspector.ColumnMetadata("type", Types.VARCHAR, 32, false),
            "data", new DatabaseInspector.ColumnMetadata("data", Types.VARCHAR, 2048, true));

    private final DatabaseInspector databaseInspector;

    public SignalDataCollectionChecker(DatabaseInspector databaseInspector) {

        this.databaseInspector = databaseInspector;
    }

    public boolean verifyTableStructure(Connection connection, String catalog, String schemaName, String tableName) {

        return databaseInspector.verifyTableStructure(connection, catalog, schemaName, tableName, this::compareWithExpectedStructure);
    }

    private boolean compareWithExpectedStructure(Map<String, DatabaseInspector.ColumnMetadata> actualColumns) {

        for (Map.Entry<String, DatabaseInspector.ColumnMetadata> expected : EXPECTED_COLUMN_METADATA.entrySet()) {
            String columnName = expected.getKey();
            DatabaseInspector.ColumnMetadata expectedMeta = expected.getValue();
            DatabaseInspector.ColumnMetadata actualMeta = Optional.ofNullable(actualColumns.get(columnName)).orElseGet(() -> actualColumns.get(columnName.toUpperCase()));

            LOGGER.trace("Comparing expected metadata {} with actual metadata {} for column {}", expectedMeta, actualMeta, columnName);
            if (!actualColumns.containsKey(columnName) && !actualColumns.containsKey(columnName.toUpperCase())) {
                LOGGER.trace("Column {} is not present in table signal data collection", columnName);
                return false;
            }

            if (!actualMeta.equals(expectedMeta)) {
                LOGGER.trace("Column {} doesn't match the excepted configuration, actual {} expected {}", columnName, actualMeta, expectedMeta);
                return false;
            }
        }

        LOGGER.trace("Signal data collection is correctly configured.");
        return true;
    }
}
