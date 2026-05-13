/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import jakarta.inject.Inject;
import jakarta.inject.Named;

import org.junit.jupiter.api.Test;
import org.testcontainers.mongodb.MongoDBContainer;

import com.mongodb.client.MongoClients;

import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.environment.connection.TestConnectionView;
import io.debezium.platform.environment.connection.source.MongoDbSourceInspector;
import io.debezium.platform.environment.connection.source.SourceInspectionException;
import io.debezium.platform.environment.connection.source.SourceInspector;
import io.debezium.platform.environment.database.db.MongoDbTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(value = MongoDbTestResource.class, restrictToAnnotatedClass = true)
public class MongoDbSourceInspectorIT {

    @Inject
    @Named("MONGODB_SOURCE_INSPECTOR")
    SourceInspector sourceInspector;

    @Test
    void listAvailableCollectionsReturnsMongoCollections() {

        MongoDBContainer container = MongoDbTestResource.getMongoDBContainer();

        String connectionString = container.getReplicaSetUrl();

        try (var client = MongoClients.create(connectionString)) {
            client.getDatabase("inventory").createCollection("customers");
            client.getDatabase("inventory").createCollection("orders");
        }

        var connection = new TestConnectionView(ConnectionEntity.Type.MONGODB, Map.of(
                MongoDbSourceInspector.MONGODB_CONNECTION_STRING, connectionString));

        var collectionTree = sourceInspector.listAvailableCollections(connection);

        assertThat(collectionTree.catalogs())
                .anySatisfy(catalog -> {
                    assertThat(catalog.name()).isEqualTo("inventory");
                    assertThat(catalog.totalCollections()).isGreaterThanOrEqualTo(2);
                    assertThat(catalog.schemas())
                            .anySatisfy(schema -> {
                                assertThat(schema.name()).isNull();
                                assertThat(schema.collections())
                                        .extracting("name")
                                        .contains("customers", "orders");
                            });
                });
    }

    @Test
    void listAvailableCollectionsThrowsSourceInspectionExceptionWhenConnectionFails() {
        var connection = new TestConnectionView(ConnectionEntity.Type.MONGODB, Map.of(
                MongoDbSourceInspector.MONGODB_CONNECTION_STRING, "mongodb://localhost:1"));

        assertThatThrownBy(() -> sourceInspector.listAvailableCollections(connection))
                .isInstanceOf(SourceInspectionException.class)
                .hasMessageContaining("Unable to get available MongoDB collections");
    }

    @Test
    void listAvailableCollectionsDoesNotLeakCredentialsWhenConnectionFails() {
        String password = "super-secret-password";
        String connectionString = "mongodb://admin:%s@localhost:1".formatted(password);

        var connection = new TestConnectionView(ConnectionEntity.Type.MONGODB, Map.of(
                MongoDbSourceInspector.MONGODB_CONNECTION_STRING, connectionString));

        assertThatThrownBy(() -> sourceInspector.listAvailableCollections(connection))
                .isInstanceOf(SourceInspectionException.class)
                .hasMessageContaining("Unable to get available MongoDB collections from mongodb://admin:****@localhost:1")
                .hasMessageNotContaining(password);
    }

    @Test
    void verifyDataCollectionStructureReturnsCurrentPlaceholderResponse() {

        MongoDBContainer container = MongoDbTestResource.getMongoDBContainer();

        String connectionString = container.getReplicaSetUrl();

        var connection = new TestConnectionView(ConnectionEntity.Type.MONGODB, Map.of(
                MongoDbSourceInspector.MONGODB_CONNECTION_STRING, connectionString));

        var result = sourceInspector.verifyDataCollectionStructure(connection, "inventory.customers");

        assertThat(result.exists()).isTrue();
        assertThat(result.message()).isEqualTo("MongoDB signal data collection verification is not implemented yet");
    }
}
