/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.literal.NamedLiteral;

@ApplicationScoped
public class CollectionListingProviderFactory {

    private final Instance<CollectionListingProvider> collectionListingProviders;

    public CollectionListingProviderFactory(Instance<CollectionListingProvider> collectionListingProviders) {
        this.collectionListingProviders = collectionListingProviders;
    }

    public CollectionListingProvider getCollectionListingProvider(String connectionType) {
        String providerName = mapToProviderName(connectionType);
        return collectionListingProviders
                .select(NamedLiteral.of(providerName))
                .get();
    }

    private String mapToProviderName(String connectionType) {
        return switch (connectionType) {
            case "ORACLE", "MYSQL", "MARIADB", "SQLSERVER", "POSTGRESQL" -> "JDBC_COLLECTION_LISTING";
            case "MONGODB" -> "MONGODB_COLLECTION_LISTING";
            default -> connectionType;
        };
    }
}
