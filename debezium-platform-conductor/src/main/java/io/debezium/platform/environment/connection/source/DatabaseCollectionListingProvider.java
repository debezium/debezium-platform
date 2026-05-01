/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import java.util.List;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.jdbc.JdbcConnection;
import io.debezium.platform.data.dto.CatalogNode;
import io.debezium.platform.data.dto.CollectionNode;
import io.debezium.platform.data.dto.CollectionTree;
import io.debezium.platform.data.dto.SchemaNode;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.database.DatabaseConnectionConfiguration;
import io.debezium.platform.environment.database.DatabaseConnectionFactory;
import io.debezium.platform.environment.database.DatabaseInspector;

@ApplicationScoped
@Named("JDBC_COLLECTION_LISTING")
public class DatabaseCollectionListingProvider implements CollectionListingProvider {

    private static final Logger LOGGER = LoggerFactory.getLogger(DatabaseCollectionListingProvider.class);

    private final DatabaseInspector databaseInspector;
    private final DatabaseConnectionFactory databaseConnectionFactory;

    public DatabaseCollectionListingProvider(DatabaseInspector databaseInspector, DatabaseConnectionFactory databaseConnectionFactory) {
        this.databaseInspector = databaseInspector;
        this.databaseConnectionFactory = databaseConnectionFactory;
    }

    @Override
    public CollectionTree listAvailableCollections(Connection connectionConfig) {

        DatabaseConnectionConfiguration databaseConnectionConfiguration = DatabaseConnectionConfiguration.from(connectionConfig);
        try (JdbcConnection jdbcConnection = databaseConnectionFactory.create(databaseConnectionConfiguration)) {

            List<CatalogNode> catalogs = databaseInspector.getAllTableNames(jdbcConnection).entrySet().stream()
                    .map(this::extractCatalogNode)
                    .toList();

            return new CollectionTree(catalogs);
        }
        catch (Exception e) {
            LOGGER.error("Unable to get available collections from host {}", databaseConnectionConfiguration.hostname(), e);
            throw new RuntimeException(String.format("Unable to get available collections from host %s", databaseConnectionConfiguration.hostname()), e);
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
