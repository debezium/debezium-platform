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
import io.debezium.platform.data.dto.SignalCollectionVerifyRequest;
import io.debezium.platform.data.dto.SignalDataCollectionVerifyResponse;
import io.debezium.platform.domain.views.Connection;

@ApplicationScoped
@Named("MONGODB_SOURCE_INSPECTOR")
public class MongoDbSourceInspector implements SourceInspector {

    private static final Logger LOGGER = LoggerFactory.getLogger(MongoDbSourceInspector.class);

    private static final String MONGODB_COLLECTIONS_SCHEMA = "collections";

    @Override
    public CollectionTree listAvailableCollections(Connection connectionConfig) {

        Configuration mongoConfig = Configuration
                .create()
                .with("mongodb.connection.string", connectionConfig.getConfig().get("mongodb.connection.string"))
                .build();

        try (MongoDbConnection connection = MongoDbConnections.create(mongoConfig)) {
            List<CollectionId> collectionIds = connection.collections();
            return toCollectionTree(collectionIds);
        }
        catch (Exception e) {
            LOGGER.error("Unable to get available MongoDB collections", e);
            throw new RuntimeException("Unable to get available MongoDB collections", e);
        }
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
                MONGODB_COLLECTIONS_SCHEMA,
                collections,
                collections.size());

        return new CatalogNode(
                databaseName,
                List.of(schema),
                collections.size());
    }

    @Override
    public SignalDataCollectionVerifyResponse verifyDataCollectionStructure(SignalCollectionVerifyRequest request) {
        return new SignalDataCollectionVerifyResponse(false, "MongoDB signal data collection verification is not implemented yet");
    }
}
