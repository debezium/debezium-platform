/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import java.util.List;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.config.Configuration;
import io.debezium.connector.mongodb.CollectionId;
import io.debezium.connector.mongodb.connection.MongoDbConnection;
import io.debezium.connector.mongodb.connection.MongoDbConnections;
import io.debezium.platform.data.dto.CatalogNode;
import io.debezium.platform.data.dto.CollectionNode;
import io.debezium.platform.data.dto.CollectionTree;
import io.debezium.platform.data.dto.SchemaNode;
import io.debezium.platform.data.dto.SignalDataCollectionVerifyResponse;
import io.debezium.platform.domain.views.Connection;

@ApplicationScoped
@Named("MONGODB_SOURCE_INSPECTOR")
public class MongoDbSourceInspector implements SourceInspector {

    private static final Logger LOGGER = LoggerFactory.getLogger(MongoDbSourceInspector.class);

    public static final String MONGODB_CONNECTION_STRING = "connection.string";

    @Override
    public CollectionTree listAvailableCollections(Connection connectionConfig) {

        Object connectionString = connectionConfig.getConfig().get(MONGODB_CONNECTION_STRING);
        Configuration mongoConfig = Configuration
                .create()
                .with("mongodb.connection.string", connectionString)
                .build();

        try (MongoDbConnection connection = MongoDbConnections.create(mongoConfig)) {
            List<CollectionId> collectionIds = connection.collections();
            return toCollectionTree(collectionIds);
        }
        catch (Exception e) {
            String sanitizedConnectionString = sanitizeConnectionString(connectionString);
            LOGGER.error("Unable to get available MongoDB collections from {}", sanitizedConnectionString, e);
            throw new SourceInspectionException(String.format("Unable to get available MongoDB collections from %s", sanitizedConnectionString), e);
        }
    }

    private String sanitizeConnectionString(Object connectionString) {
        if (!(connectionString instanceof String value) || value.isBlank()) {
            return "<missing MongoDB connection string>";
        }

        return value.replaceFirst(
                "^(mongodb(?:\\+srv)?://)([^:/@]+):([^@]+)@",
                "$1$2:****@");
    }

    private CollectionTree toCollectionTree(List<CollectionId> collectionIds) {
        List<CatalogNode> catalogs = collectionIds.stream()
                .collect(Collectors.groupingBy(CollectionId::dbName))
                .entrySet()
                .stream()
                .map(entry -> toCatalogNode(entry.getKey(), entry.getValue()))
                .toList();

        return new CollectionTree(catalogs);
    }

    private CatalogNode toCatalogNode(String databaseName, List<CollectionId> collectionIds) {
        List<CollectionNode> collections = collectionIds.stream()
                .map(collectionId -> new CollectionNode(collectionId.name(), collectionId.toString()))
                .toList();

        SchemaNode schema = new SchemaNode(
                null,
                collections,
                collections.size());

        return new CatalogNode(
                databaseName,
                List.of(schema),
                collections.size());
    }

    @Override
    public SignalDataCollectionVerifyResponse verifyDataCollectionStructure(Connection connection,
                                                                            String fullyQualifiedTableName) {
        return new SignalDataCollectionVerifyResponse(true, "MongoDB signal data collection verification is not implemented yet");
    }
}
