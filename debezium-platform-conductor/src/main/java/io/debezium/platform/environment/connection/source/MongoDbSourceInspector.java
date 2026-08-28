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

import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.mongodb.client.model.Filters;

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
    public static final String MONGODB_CREDENTIALS_MASKING_REGEX = "^(mongodb(?:\\+srv)?://)([^:/@]+):([^@]+)@";

    private static final String SIGNAL_DATA_COLLECTION_CONFIGURED_MESSAGE = "Signal data collection correctly configured";
    private static final String SIGNAL_DATA_COLLECTION_NOT_PRESENT_MESSAGE = "Signal data collection not present";
    private static final String SIGNAL_DATA_COLLECTION_NAME_REQUIRED_MESSAGE = "A fully qualified signal data collection name is required";

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
                MONGODB_CREDENTIALS_MASKING_REGEX,
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

    /**
     * Verifies that the signal data collection exists.
     * <p>
     * Unlike the relational inspectors this cannot check a structure: collections are schemaless, and a
     * correctly configured signal collection is normally empty, so there is no document to inspect. Presence
     * of the namespace is what can be established, and it is enough to catch the misspelled name that
     * prompted this check.
     */
    @Override
    public SignalDataCollectionVerifyResponse verifyDataCollectionStructure(Connection connection,
                                                                            String fullyQualifiedTableName) {

        if (fullyQualifiedTableName == null || fullyQualifiedTableName.isBlank()) {
            LOGGER.warn("Signal data collection verification requested without a collection name");
            return new SignalDataCollectionVerifyResponse(false, SIGNAL_DATA_COLLECTION_NAME_REQUIRED_MESSAGE);
        }

        // <databaseName>.<collectionName>, split on the FIRST dot because a collection name may itself
        // contain dots. Returns null when there is no database part.
        CollectionId collectionId = CollectionId.parse(fullyQualifiedTableName);
        if (collectionId == null || collectionId.dbName().isBlank() || collectionId.name().isBlank()) {
            LOGGER.warn("Unable to parse signal data collection name {}", fullyQualifiedTableName);
            return new SignalDataCollectionVerifyResponse(false, SIGNAL_DATA_COLLECTION_NAME_REQUIRED_MESSAGE);
        }

        Object connectionString = connection.getConfig().get(MONGODB_CONNECTION_STRING);
        Configuration mongoConfig = Configuration
                .create()
                .with("mongodb.connection.string", connectionString)
                .build();

        try (MongoDbConnection mongoDbConnection = MongoDbConnections.create(mongoConfig)) {

            boolean exists = collectionExists(mongoDbConnection, collectionId);

            String message = exists
                    ? SIGNAL_DATA_COLLECTION_CONFIGURED_MESSAGE
                    : SIGNAL_DATA_COLLECTION_NOT_PRESENT_MESSAGE;

            return new SignalDataCollectionVerifyResponse(exists, message);
        }
        catch (Exception e) {
            String sanitizedConnectionString = sanitizeConnectionString(connectionString);
            LOGGER.error("Unable to verify signal data collection on {}", sanitizedConnectionString, e);
            return new SignalDataCollectionVerifyResponse(false,
                    String.format("Unable to verify signal data collection on %s", sanitizedConnectionString));
        }
    }

    /**
     * Asks the target database for that one collection rather than listing every collection in the cluster,
     * so the answer does not depend on the connector's database and collection filters.
     */
    private boolean collectionExists(MongoDbConnection connection, CollectionId collectionId) {

        Document collection = connection.getMongoClient()
                .getDatabase(collectionId.dbName())
                .listCollections()
                .filter(Filters.eq("name", collectionId.name()))
                .first();

        return collection != null;
    }
}
