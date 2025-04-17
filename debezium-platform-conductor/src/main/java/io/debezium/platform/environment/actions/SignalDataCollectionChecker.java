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

import io.agroal.api.AgroalDataSource;
import jakarta.enterprise.context.ApplicationScoped;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ApplicationScoped
public class SignalDataCollectionChecker {

    private static final Logger LOGGER = LoggerFactory.getLogger(SignalDataCollectionChecker.class);

    private static final Map<String, ColumnMetadata> EXPECTED_COLUMN_METADATA = Map.of(
            "id", new ColumnMetadata("id", Types.VARCHAR, 42, false),
            "type", new ColumnMetadata("id", Types.VARCHAR, 32, false),
            "data", new ColumnMetadata("id", Types.VARCHAR, 2048, true)
    );
    private static final String COLUMN_NAME_ATTRIBUTE = "COLUMN_NAME";
    private static final String DATA_TYPE_ATTRIBUTE = "DATA_TYPE";
    private static final String COLUMN_SIZE_ATTRIBUTE = "COLUMN_SIZE";
    private static final String NULLABLE_ATTRIBUTE = "NULLABLE";

    private final AgroalDataSource dataSource;

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
    }

    public SignalDataCollectionChecker(AgroalDataSource dataSource) {
        this.dataSource = dataSource;
    }

    public boolean verifyTableStructure(String catalog, String tableName, String schemaName) {

        try(Connection conn = dataSource.getConnection()) {

            DatabaseMetaData metaData = conn.getMetaData();

            ResultSet tables = metaData.getTables(
                    catalog,
                    schemaName,
                    tableName,
                    new String[]{ "TABLE" }
            );

            boolean tableExists = tables.next();
            tables.close();

            if (!tableExists) {
                return false;
            }

            return hasCorrectStructure(tableName, schemaName, metaData, catalog);
        }
        catch (SQLException e) {
            return false; //TODO check error
        }
    }

    private boolean hasCorrectStructure(String tableName, String schemaName, DatabaseMetaData metaData, String catalog) throws SQLException {

        Map<String, ColumnMetadata> actualColumns = new HashMap<>();
        ResultSet columns = metaData.getColumns(catalog, schemaName, tableName, null);

        while (columns.next()) {
            ColumnMetadata value = getColumnMetadata(columns);
            actualColumns.put(value.name(), value);
        }
        columns.close();

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
            ColumnMetadata actualMeta = actualColumns.get(columnName);

            if (!actualColumns.containsKey(columnName)) {
                return false;
            }

            if (!actualMeta.equals(expectedMeta)) {
                return false;
            }
        }

        return true;
    }
}
