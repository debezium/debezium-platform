/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.jdbc.JdbcConnection;
import io.debezium.platform.data.dto.CatalogNode;
import io.debezium.platform.data.dto.CollectionNode;
import io.debezium.platform.data.dto.CollectionTree;
import io.debezium.platform.data.dto.SchemaNode;
import io.debezium.platform.data.dto.SignalDataCollectionVerifyResponse;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.database.DatabaseConnectionConfiguration;
import io.debezium.platform.environment.database.DatabaseConnectionFactory;
import io.debezium.relational.TableId;

@ApplicationScoped
@Named("JDBC_SOURCE_INSPECTOR")
public class JdbcSourceInspector implements SourceInspector {

    private static final Logger LOGGER = LoggerFactory.getLogger(JdbcSourceInspector.class);

    private static final String SIGNAL_DATA_COLLECTION_CONFIGURED_MESSAGE = "Signal data collection correctly configured";
    private static final String SIGNAL_DATA_COLLECTION_MISS_CONFIGURED_MESSAGE = "Signal data collection not present or misconfigured";

    private static final String COLUMN_NAME_ATTRIBUTE = "COLUMN_NAME";
    private static final String DATA_TYPE_ATTRIBUTE = "DATA_TYPE";
    private static final String COLUMN_SIZE_ATTRIBUTE = "COLUMN_SIZE";
    private static final String NULLABLE_ATTRIBUTE = "NULLABLE";
    private static final String TABLE_TYPE = "TABLE";

    private static final Map<String, ColumnMetadata> EXPECTED_COLUMN_METADATA = Map.of(
            "id", new ColumnMetadata("id", Types.VARCHAR, 42, false),
            "type", new ColumnMetadata("type", Types.VARCHAR, 32, false),
            "data", new ColumnMetadata("data", Types.VARCHAR, 2048, true));

    private final DatabaseConnectionFactory databaseConnectionFactory;

    public JdbcSourceInspector(DatabaseConnectionFactory databaseConnectionFactory) {
        this.databaseConnectionFactory = databaseConnectionFactory;
    }

    @Override
    public CollectionTree listAvailableCollections(Connection connectionConfig) {

        DatabaseConnectionConfiguration databaseConnectionConfiguration = DatabaseConnectionConfiguration.from(connectionConfig);
        try (JdbcConnection jdbcConnection = databaseConnectionFactory.create(databaseConnectionConfiguration)) {

            List<CatalogNode> catalogs = getAllTableNames(jdbcConnection).entrySet().stream()
                    .map(this::extractCatalogNode)
                    .toList();

            return new CollectionTree(catalogs);
        }
        catch (Exception e) {
            LOGGER.error("Unable to get available collections from host {}", databaseConnectionConfiguration.hostname(), e);
            throw new RuntimeException(String.format("Unable to get available collections from host %s", databaseConnectionConfiguration.hostname()), e);
        }
    }

    private Map<String, Map<String, List<CollectionNode>>> getAllTableNames(JdbcConnection connection) throws SQLException {

        Map<String, Map<String, List<CollectionNode>>> hierarchicalData = new HashMap<>();

        Set<TableId> tableIds = connection.getAllTableIds(connection.database());
        tableIds.forEach(tableId -> {
            CollectionNode collectionNode = new CollectionNode(tableId.table(), tableId.identifier());

            hierarchicalData
                    .computeIfAbsent(tableId.catalog(), k -> new HashMap<>())
                    .computeIfAbsent(tableId.schema(), k -> new ArrayList<>())
                    .add(collectionNode);
        });

        return hierarchicalData;
    }

    @Override
    public SignalDataCollectionVerifyResponse verifyDataCollectionStructure(Connection connection, String fullyQualifiedTableName) {

        DatabaseConnectionConfiguration databaseConnectionConfiguration = DatabaseConnectionConfiguration.from(connection);

        try (JdbcConnection jdbcConnection = databaseConnectionFactory.create(databaseConnectionConfiguration)) {

            var table = TableId.parse(fullyQualifiedTableName, false);

            boolean isConform = verifyTableStructure(
                    jdbcConnection.connection(),
                    databaseConnectionConfiguration.database(),
                    table.schema(),
                    table.table());

            String message = isConform
                    ? SIGNAL_DATA_COLLECTION_CONFIGURED_MESSAGE
                    : SIGNAL_DATA_COLLECTION_MISS_CONFIGURED_MESSAGE;

            return new SignalDataCollectionVerifyResponse(isConform, message);
        }
        catch (Exception e) {
            LOGGER.error("Unable to verify signal data collection", e);
            return new SignalDataCollectionVerifyResponse(false, e.getMessage());
        }
    }

    private boolean verifyTableStructure(java.sql.Connection connection, String catalog, String schemaName, String tableName) throws SQLException {
        try (java.sql.Connection conn = connection) {
            DatabaseMetaData metaData = conn.getMetaData();

            ResultSet tables = metaData.getTables(
                    catalog,
                    schemaName,
                    tableName,
                    new String[]{ TABLE_TYPE });

            boolean tableExists = tables.next();
            tables.close();

            if (!tableExists) {
                LOGGER.debug("Table {} doesn't exist in schema {} and catalog {}", tableName, schemaName, catalog);
                return false;
            }

            return hasCorrectStructure(tableName, schemaName, metaData, catalog);
        }
    }

    private boolean compareWithExpectedStructure(Map<String, ColumnMetadata> actualColumns) {

        for (Map.Entry<String, ColumnMetadata> expected : EXPECTED_COLUMN_METADATA.entrySet()) {
            String columnName = expected.getKey();
            ColumnMetadata expectedMeta = expected.getValue();
            ColumnMetadata actualMeta = Optional.ofNullable(actualColumns.get(columnName)).orElseGet(() -> actualColumns.get(columnName.toUpperCase()));

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

    private boolean hasCorrectStructure(String tableName, String schemaName, DatabaseMetaData metaData, String catalog)
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
        return compareWithExpectedStructure(actualColumns);
    }

    private ColumnMetadata getColumnMetadata(ResultSet columns) throws SQLException {

        String columnName = columns.getString(COLUMN_NAME_ATTRIBUTE);
        int dataType = columns.getInt(DATA_TYPE_ATTRIBUTE);
        int columnSize = columns.getInt(COLUMN_SIZE_ATTRIBUTE);
        boolean isNullable = columns.getInt(NULLABLE_ATTRIBUTE) == DatabaseMetaData.columnNullable;

        return new ColumnMetadata(columnName, dataType, columnSize, isNullable);
    }

    private CatalogNode extractCatalogNode(Map.Entry<String, Map<String, List<CollectionNode>>> catalogEntry) {
        List<SchemaNode> schemas = catalogEntry.getValue().entrySet().stream()
                .map(this::extractSchemaNode)
                .toList();

        int totalTables = schemas.stream()
                .mapToInt(SchemaNode::collectionCount)
                .sum();

        return new CatalogNode(
                catalogEntry.getKey(),
                schemas,
                totalTables);
    }

    private SchemaNode extractSchemaNode(Map.Entry<String, List<CollectionNode>> schemaEntry) {
        List<CollectionNode> tablesList = schemaEntry.getValue();
        return new SchemaNode(
                schemaEntry.getKey(),
                tablesList,
                tablesList.size());

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
