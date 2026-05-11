/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
import io.debezium.platform.environment.actions.SignalDataCollectionChecker;
import io.debezium.platform.environment.database.DatabaseConnectionConfiguration;
import io.debezium.platform.environment.database.DatabaseConnectionFactory;
import io.debezium.relational.TableId;

@ApplicationScoped
@Named("JDBC_SOURCE_INSPECTOR")
public class JdbcSourceInspector implements SourceInspector {

    private static final Logger LOGGER = LoggerFactory.getLogger(JdbcSourceInspector.class);

    private static final String SIGNAL_DATA_COLLECTION_CONFIGURED_MESSAGE = "Signal data collection correctly configured";
    private static final String SIGNAL_DATA_COLLECTION_MISS_CONFIGURED_MESSAGE = "Signal data collection not present or misconfigured";

    private final DatabaseConnectionFactory databaseConnectionFactory;
    private final SignalDataCollectionChecker signalDataCollectionChecker;

    public JdbcSourceInspector(DatabaseConnectionFactory databaseConnectionFactory, SignalDataCollectionChecker signalDataCollectionChecker) {
        this.databaseConnectionFactory = databaseConnectionFactory;
        this.signalDataCollectionChecker = signalDataCollectionChecker;
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
            throw new SourceInspectionException(String.format("Unable to get available collections from host %s", databaseConnectionConfiguration.hostname()), e);
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

            boolean isConform = signalDataCollectionChecker.verifyTableStructure(
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

}
