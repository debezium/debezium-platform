/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Predicate;

import jakarta.enterprise.context.ApplicationScoped;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.DebeziumException;
import io.debezium.platform.data.dto.CollectionNode;

@ApplicationScoped
public class DatabaseInspector {

    private static final Logger LOGGER = LoggerFactory.getLogger(DatabaseInspector.class);

    private static final String COLUMN_NAME_ATTRIBUTE = "COLUMN_NAME";
    private static final String DATA_TYPE_ATTRIBUTE = "DATA_TYPE";
    private static final String COLUMN_SIZE_ATTRIBUTE = "COLUMN_SIZE";
    private static final String NULLABLE_ATTRIBUTE = "NULLABLE";
    private static final String TABLE_TYPE = "TABLE";
    private static final String MATCH_ALL_PATTERN = "%";
    private static final String TABLE_CATALOG_COLUMN_NAME = "TABLE_CAT";
    private static final String TABLE_SCHEMA_COLUMN_NAME = "TABLE_SCHEM";
    private static final String TABLE_NAME_COLUMN_NAME = "TABLE_NAME";

    public DatabaseInspector() {
    }

    public boolean verifyTableStructure(Connection connection, String catalog, String schemaName, String tableName,
                                        Predicate<Map<String, ColumnMetadata>> validateFunction) {

        try (Connection conn = connection) {

            DatabaseMetaData metaData = conn.getMetaData();

            ResultSet tables = metaData.getTables(
                    catalog,
                    schemaName,
                    tableName,
                    new String[]{ TABLE_TYPE });

            boolean tableExists = tables.next();

            tables.close();

            if (!tableExists) {
                LOGGER.debug("Table {} doesn't exists in schema {} and catalog {}", tableName, schemaName, catalog);
                return false;
            }

            return hasCorrectStructure(tableName, schemaName, metaData, catalog, validateFunction);
        }
        catch (SQLException e) {
            throw new DebeziumException(String.format("Error while verifying structure for table %s", tableName));
        }
    }

    private boolean hasCorrectStructure(String tableName, String schemaName, DatabaseMetaData metaData, String catalog,
                                        Predicate<Map<String, ColumnMetadata>> validateFunction)
            throws SQLException {

        LOGGER.debug("Table {} exists in schema {} and catalog {}. Checking structure.", tableName, schemaName, catalog);
        Map<String, ColumnMetadata> actualColumns = new HashMap<>();
        ResultSet columns = metaData.getColumns(catalog, schemaName, tableName, null);

        while (columns.next()) {
            ColumnMetadata value = getColumnMetadata(columns);
            actualColumns.put(value.name(), value);
        }
        columns.close();

        LOGGER.trace("Table {} metadata {}", tableName, actualColumns);
        return validateFunction.test(actualColumns);
    }

    /**
     * Retrieves fully qualified table names grouped by schema and catalog (catalog.schema.table format)
     *
     * @param connection JDBC connection
     * @return Map of fully qualified table names grouped by schema and catalog
     * @throws SQLException if database access error occurs
     */
    public Map<String, Map<String, List<CollectionNode>>> getAllTableNames(Connection connection) throws SQLException {

        Map<String, Map<String, List<CollectionNode>>> hierarchicalData = new HashMap<>();

        try (Connection conn = connection) {
            DatabaseMetaData metaData = conn.getMetaData();

            try (ResultSet tables = metaData.getTables(null, null, MATCH_ALL_PATTERN, new String[]{ TABLE_TYPE })) {
                while (tables.next()) {
                    String catalog = tables.getString(TABLE_CATALOG_COLUMN_NAME);
                    String schema = tables.getString(TABLE_SCHEMA_COLUMN_NAME);
                    String tableName = tables.getString(TABLE_NAME_COLUMN_NAME);

                    CollectionNode collectionNode = new CollectionNode(tableName, buildFullyQualifiedName(catalog, schema, tableName));

                    hierarchicalData
                            .computeIfAbsent(catalog, k -> new HashMap<>())
                            .computeIfAbsent(schema, k -> new ArrayList<>())
                            .add(collectionNode);
                }
            }
        }

        return hierarchicalData;
    }

    private String buildFullyQualifiedName(String catalog, String schema, String tableName) {
        String catalogPart = (catalog != null && !catalog.trim().isEmpty()) ? catalog + "." : "";
        String schemaPart = (schema != null && !schema.trim().isEmpty()) ? schema + "." : "";

        return String.format("%s%s%s", catalogPart, schemaPart, tableName);
    }

    private ColumnMetadata getColumnMetadata(ResultSet columns) throws SQLException {

        String columnName = columns.getString(COLUMN_NAME_ATTRIBUTE);
        int dataType = columns.getInt(DATA_TYPE_ATTRIBUTE);
        int columnSize = columns.getInt(COLUMN_SIZE_ATTRIBUTE);
        boolean isNullable = columns.getInt(NULLABLE_ATTRIBUTE) == DatabaseMetaData.columnNullable;

        return new ColumnMetadata(columnName, dataType, columnSize, isNullable);
    }

    public record ColumnMetadata(
            String name,
            int sqlType,
            int size,
            boolean nullable) {

        @Override
        public boolean equals(Object o) {
            if (o == null || getClass() != o.getClass()) {
                return false;
            }
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
}
