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
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.mongodb.client.MongoClients;

import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
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
    void listAvailableCollectionsReturnsMongoCollections(TestInfo testInfo) {

        String database = databaseFor(testInfo);
        createCollection(database, "customers");
        createCollection(database, "orders");

        var collectionTree = sourceInspector.listAvailableCollections(mongoConnection());

        // The tree covers the whole cluster, so it also holds databases the other tests created.
        // Narrowing to this test's own database is what lets the assertions below be exact.
        assertThat(collectionTree.catalogs())
                .filteredOn(catalog -> catalog.name().equals(database))
                .singleElement()
                .satisfies(catalog -> {
                    assertThat(catalog.totalCollections()).isEqualTo(2);
                    assertThat(catalog.schemas())
                            .singleElement()
                            .satisfies(schema -> {
                                assertThat(schema.name()).isNull();
                                assertThat(schema.collections())
                                        .extracting("name")
                                        .containsExactlyInAnyOrder("customers", "orders");
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
    void verifyDataCollectionStructureFindsAnExistingCollection(TestInfo testInfo) {

        String database = databaseFor(testInfo);
        createCollection(database, "debezium_signal");

        var result = sourceInspector.verifyDataCollectionStructure(mongoConnection(), database + ".debezium_signal");

        assertThat(result.exists()).isTrue();
        assertThat(result.message()).isEqualTo("Signal data collection correctly configured");
    }

    @Test
    void verifyDataCollectionStructureReportsAMissingCollection(TestInfo testInfo) {

        String database = databaseFor(testInfo);
        // The database exists; only the collection is absent.
        createCollection(database, "shipments");

        var result = sourceInspector.verifyDataCollectionStructure(mongoConnection(), database + ".no_such_collection");

        assertThat(result.exists()).isFalse();
        assertThat(result.message()).isEqualTo("Signal data collection not present");
    }

    @Test
    void verifyDataCollectionStructureReportsAMisspelledDatabase(TestInfo testInfo) {

        String database = databaseFor(testInfo);
        createCollection(database, "debezium_signal");

        // The false positive from dbz#2270: the collection exists, but under a database whose
        // name was mistyped — here by dropping its last character.
        String misspelled = database.substring(0, database.length() - 1);

        var result = sourceInspector.verifyDataCollectionStructure(mongoConnection(), misspelled + ".debezium_signal");

        assertThat(result.exists()).isFalse();
        assertThat(result.message()).isEqualTo("Signal data collection not present");
    }

    @ParameterizedTest(name = "A signal data collection named [{0}] is rejected")
    @NullSource
    @ValueSource(strings = { "", "   ", "debezium_signal", ".debezium_signal", "ecommerce.", " .debezium_signal", "ecommerce. " })
    void verifyDataCollectionStructureRejectsAnUnusableName(String fullyQualifiedTableName) {

        var result = sourceInspector.verifyDataCollectionStructure(mongoConnection(), fullyQualifiedTableName);

        assertThat(result.exists()).isFalse();
        assertThat(result.message()).isEqualTo("A fully qualified signal data collection name is required");
    }

    @Test
    void verifyDataCollectionStructureDoesNotLeakCredentialsWhenConnectionFails() {
        String password = "super-secret-password";
        String connectionString = "mongodb://admin:%s@localhost:1/?serverSelectionTimeoutMS=2000".formatted(password);

        var connection = new TestConnectionView(ConnectionEntity.Type.MONGODB, Map.of(
                MongoDbSourceInspector.MONGODB_CONNECTION_STRING, connectionString));

        var result = sourceInspector.verifyDataCollectionStructure(connection, "ecommerce.debezium_signal");

        assertThat(result.exists()).isFalse();
        // Asserted in full rather than as "does not contain the password": a fixed message would
        // satisfy that trivially, and this fails loudly if the masking ever regresses.
        assertThat(result.message())
                .isEqualTo("Unable to verify signal data collection on mongodb://admin:****@localhost:1/?serverSelectionTimeoutMS=2000");
        assertThat(result.message()).doesNotContain(password);
    }

    private Connection mongoConnection() {
        return new TestConnectionView(ConnectionEntity.Type.MONGODB, Map.of(
                MongoDbSourceInspector.MONGODB_CONNECTION_STRING,
                MongoDbTestResource.getMongoDBContainer().getReplicaSetUrl()));
    }

    private void createCollection(String database, String collection) {
        try (var client = MongoClients.create(MongoDbTestResource.getMongoDBContainer().getReplicaSetUrl())) {
            client.getDatabase(database).createCollection(collection);
        }
    }

    /**
     * A database of its own per test. The container is shared by the whole class and nothing drops
     * what a test creates, so a name derived from the test method is what keeps these independent
     * of each other and of the order they run in. MongoDB caps a database name at 63 bytes and
     * these method names are long, so only the tail — the part that differs — is kept.
     */
    private static String databaseFor(TestInfo testInfo) {
        String method = testInfo.getTestMethod().orElseThrow().getName().toLowerCase();
        return "it_" + method.substring(Math.max(0, method.length() - 40));
    }
}
