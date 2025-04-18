/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import io.debezium.DebeziumException;
import jakarta.enterprise.context.ApplicationScoped;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ApplicationScoped
public class SignalDataCollectionChecker {

    private static final Logger LOGGER = LoggerFactory.getLogger(SignalDataCollectionChecker.class);

    private static final Map<String, ColumnMetadata> EXPECTED_COLUMN_METADATA = Map.of(
            "id", new ColumnMetadata("id", Types.VARCHAR, 42, false),
            "type", new ColumnMetadata("type", Types.VARCHAR, 32, false),
            "data", new ColumnMetadata("data", Types.VARCHAR, 2048, true)
    );
    private static final String COLUMN_NAME_ATTRIBUTE = "COLUMN_NAME";
    private static final String DATA_TYPE_ATTRIBUTE = "DATA_TYPE";
    private static final String COLUMN_SIZE_ATTRIBUTE = "COLUMN_SIZE";
    private static final String NULLABLE_ATTRIBUTE = "NULLABLE";
    private static final String TABLE_TYPE = "TABLE";

    private final Connection connection;

    private record ColumnMetadata(
            String name,
            int sqlType,
            int size,
            boolean nullable) {

        @Override
        public boolean equals(Object o) {
            if (o == null || getClass() != o.getClass())
                return false;
            ColumnMetadata that = (ColumnMetadata) o;
            return size == that.size && sqlType == that.sqlType && nullable == that.nullable;
        }

        @Override
        public int hashCode() {
            return Objects.hash(sqlType, size, nullable);
        }

        @Override
        public String toString() {
            return "ColumnMetadata{" +
                    "name='" + name + '\'' +
                    ", sqlType=" + sqlType +
                    ", size=" + size +
                    ", nullable=" + nullable +
                    '}';
        }
    }

    public SignalDataCollectionChecker(Connection connection) {
        this.connection = connection;
    }

    public boolean verifyTableStructure(String catalog, String tableName, String schemaName) {

        try(Connection conn = connection) {

            DatabaseMetaData metaData = conn.getMetaData();

            ResultSet tables = metaData.getTables(
                    catalog,
                    schemaName,
                    tableName,
                    new String[]{ TABLE_TYPE }
            );

            boolean tableExists = tables.next();

            tables.close();

            if (!tableExists) {
                LOGGER.debug("Table {} doesn't exists in schema {} and catalog {}", tableName, schemaName, catalog);
                return false;
            }

            return hasCorrectStructure(tableName, schemaName, metaData, catalog);
        }
        catch (SQLException e) {
            throw new DebeziumException(String.format("Error while verifying structure for table %s", tableName));
        }
    }

    private boolean hasCorrectStructure(String tableName, String schemaName, DatabaseMetaData metaData, String catalog) throws SQLException {

        LOGGER.debug("Table {} exists in schema {} and catalog {}. Checking structure.", tableName, schemaName, catalog);
        Map<String, ColumnMetadata> actualColumns = new HashMap<>();
        ResultSet columns = metaData.getColumns(catalog, schemaName, tableName, null);

        while (columns.next()) {
            ColumnMetadata value = getColumnMetadata(columns);
            actualColumns.put(value.name(), value);
        }
        columns.close();

        LOGGER.trace("Table {} metadata {}", tableName, actualColumns);
        return compareWithExpectedStructure(actualColumns);
    }

    private static ColumnMetadata getColumnMetadata(ResultSet columns) throws SQLException {

        String columnName = columns.getString(COLUMN_NAME_ATTRIBUTE);
        int dataType = columns.getInt(DATA_TYPE_ATTRIBUTE);
        int columnSize = columns.getInt(COLUMN_SIZE_ATTRIBUTE);
        boolean isNullable = columns.getInt(NULLABLE_ATTRIBUTE) == DatabaseMetaData.columnNullable;

        return new ColumnMetadata(columnName, dataType, columnSize, isNullable);
    }

    private boolean compareWithExpectedStructure(Map<String, ColumnMetadata> actualColumns) {

        for (Map.Entry<String, ColumnMetadata> expected : EXPECTED_COLUMN_METADATA.entrySet()) {
            String columnName = expected.getKey();
            ColumnMetadata expectedMeta = expected.getValue();
            ColumnMetadata actualMeta = Optional.ofNullable(actualColumns.get(columnName)).orElseGet(()-> actualColumns.get(columnName.toUpperCase()));

            LOGGER.trace("Comparing expected metadata {} with actual metadata {} for column {}", expectedMeta, actualMeta, columnName);
            if (!actualColumns.containsKey(columnName) && !actualColumns.containsKey(columnName.toUpperCase())) {
                return false;
            }

            if (!actualMeta.equals(expectedMeta)) {
                return false;
            }
        }

        return true;
    }
}
