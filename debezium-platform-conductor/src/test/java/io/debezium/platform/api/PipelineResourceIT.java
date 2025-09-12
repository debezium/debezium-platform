/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.temporal.ChronoUnit;

import jakarta.inject.Inject;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.testcontainers.shaded.org.awaitility.Awaitility;

import io.debezium.operator.api.model.DebeziumServer;
import io.debezium.platform.MockedTestProfile;
import io.debezium.platform.environment.operator.actions.DebeziumKubernetesAdapter;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.server.mock.EnableKubernetesMockClient;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
// This forces Quarkus to load another test context so that the @InjectMock works as expected.
@TestProfile(MockedTestProfile.class)
@EnableKubernetesMockClient(crud = true)
class PipelineResourceIT {

    @Inject
    private KubernetesClient kubernetesClient;

    @InjectMock
    DebeziumKubernetesAdapter k8sAdapter;

    ArgumentCaptor<DebeziumServer> debeziumServerArgumentCaptor;

    @BeforeEach
    void setUp() {

        debeziumServerArgumentCaptor = ArgumentCaptor.forClass(DebeziumServer.class);

        createResource("api/connections", """
                {
                       "name": "postgres-connection",
                       "type": "POSTGRESQL",
                       "config": {
                         "hostname": "postgresql",
                         "port": 5432,
                         "username": "debezium",
                         "password": "debezium",
                         "database": "debezium"
                       }
                     }
                  }""");

        createResource("api/connections", """
                {
                     "name": "kafka-connection",
                     "type": "KAFKA",
                     "config": {
                       "bootstrap.servers": "dbz-kafka-kafka-bootstrap.debezium-platform:9092"
                     }
                   }""");

        createResource("api/sources", """
                {
                    "name": "test-source",
                    "description": "Yummy data source",
                    "type": "io.debezium.connector.postgresql.PostgresConnector",
                    "schema": "dummy",
                    "vaults": [],
                    "connection": {
                        "id": 1
                    },
                    "config": {
                      "topic.prefix": "inventory",
                      "schema.include.list": "inventory"
                    }
                  }""");

        createResource("api/destinations", """
                 {
                  "name": "test-destination",
                  "type": "kafka",
                  "description": "Some funny destination",
                  "schema": "dummy",
                  "vaults": [],
                   "connection": {
                        "id":2
                    },
                  "config": {
                    "producer.key.serializer": "org.apache.kafka.common.serialization.StringSerializer",
                    "producer.value.serializer": "org.apache.kafka.common.serialization.StringSerializer"
                  }
                }""");

        createResource("api/transforms", """
                {
                   "name": "Debezium marker",
                   "description": "Extract Debezium payload",
                   "type": "io.debezium.transforms.ExtractNewRecordState",
                   "schema": "string",
                   "vaults": [
                   ],
                   "config": {
                     "add.fields": "op",
                     "add.headers": "db,table"
                   },
                   "predicate": {
                     "type": "org.apache.kafka.connect.transforms.predicates.TopicNameMatches",
                     "config": {
                       "pattern": "inventory.inventory.products"
                     },
                     "negate": false
                   }
                 }""");
    }

    private static void createResource(String path, String body) {

        given()
                .header("Content-Type", "application/json")
                .body(body).when().post(path)
                .then()
                .statusCode(201);
    }

    @Test
    @DisplayName("When a pipeline is created then a debezium server instance must be created on the environment")
    void createPipeline() {

        String jsonBody = """
                {
                   "name": "test-pipeline",
                   "description": "It goes from here to there!",
                   "source": {
                     "id": 1,
                     "name": "test-source"
                   },
                   "destination": {
                     "id": 1,
                     "name": "test-destination"
                   },
                   "transforms": [
                     {
                       "name": "ExtractRecords",
                       "id": 1
                     }
                   ],
                   "logLevel": "INFO",
                   "logLevels": {
                     "io.debezium.pipeline.EventDispatcher": "TRACE"
                   }
                 }""";

        given()
                .header("Content-Type", "application/json")
                .body(jsonBody).when().post("api/pipelines")
                .then()
                .statusCode(201);

        Awaitility.await()
                .atMost(Duration.of(120, ChronoUnit.SECONDS))
                .pollDelay(Duration.of(100, ChronoUnit.MILLIS))
                .pollInterval(Duration.of(500, ChronoUnit.MILLIS))
                .untilAsserted(() -> {
                    Mockito.verify(k8sAdapter).deployPipeline(debeziumServerArgumentCaptor.capture());
                });

        DebeziumServer debeziumServer = debeziumServerArgumentCaptor.getValue();

        assertThat(debeziumServer.asConfiguration().getAsMapSimple())
                .containsEntry("debezium.api.enabled", "true")
                .containsEntry("debezium.format.header", "json")
                .containsEntry("debezium.format.key", "json")
                .containsEntry("debezium.format.value", "json")
                .containsEntry("debezium.predicates", "p1")
                .containsEntry("debezium.predicates.p1.pattern", "inventory.inventory.products")
                .containsEntry("debezium.predicates.p1.type", "org.apache.kafka.connect.transforms.predicates.TopicNameMatches")
                .containsEntry("debezium.sink.kafka.producer.bootstrap.servers", "dbz-kafka-kafka-bootstrap.debezium-platform:9092")
                .containsEntry("debezium.sink.kafka.producer.key.serializer", "org.apache.kafka.common.serialization.StringSerializer")
                .containsEntry("debezium.sink.kafka.producer.value.serializer", "org.apache.kafka.common.serialization.StringSerializer")
                .containsEntry("debezium.sink.type", "kafka")
                .containsEntry("debezium.source.connector.class", "io.debezium.connector.postgresql.PostgresConnector")
                .containsEntry("debezium.source.database.dbname", "debezium")
                .containsEntry("debezium.source.database.hostname", "postgresql")
                .containsEntry("debezium.source.database.password", "debezium")
                .containsEntry("debezium.source.database.port", "5432")
                .containsEntry("debezium.source.database.user", "debezium")
                .containsEntry("debezium.source.notification.enabled.channels", "log")
                .containsEntry("debezium.source.offset.flush.interval.ms", "60000")
                .containsEntry("debezium.source.offset.storage", "io.debezium.storage.jdbc.offset.JdbcOffsetBackingStore")
                .containsEntry("debezium.source.offset.storage.jdbc.offset.table.name", "test_pipeline_offset")
                .containsEntry("debezium.source.offset.storage.jdbc.password", "quarkus")
                .containsEntry("debezium.source.offset.storage.jdbc.url", "jdbc:postgresql://localhost:5432/quarkus?loggerLevel=OFF")
                .containsEntry("debezium.source.offset.storage.jdbc.user", "quarkus")
                .containsEntry("debezium.source.schema.history.internal", "io.debezium.storage.jdbc.history.JdbcSchemaHistory")
                .containsEntry("debezium.source.schema.history.internal.jdbc.password", "quarkus")
                .containsEntry("debezium.source.schema.history.internal.jdbc.schema.history.table.name", "test_pipeline_schema_history")
                .containsEntry("debezium.source.schema.history.internal.jdbc.url", "jdbc:postgresql://localhost:5432/quarkus?loggerLevel=OFF")
                .containsEntry("debezium.source.schema.history.internal.jdbc.user", "quarkus")
                .containsEntry("debezium.source.schema.include.list", "inventory")
                .containsEntry("debezium.source.signal.enabled.channels", "source,in-process")
                .containsEntry("debezium.source.topic.prefix", "inventory")
                .containsEntry("debezium.transforms", "t0")
                .containsEntry("debezium.transforms.t0.add.fields", "op")
                .containsEntry("debezium.transforms.t0.add.headers", "db,table")
                .containsEntry("debezium.transforms.t0.negate", "false")
                .containsEntry("debezium.transforms.t0.predicate", "p1")
                .containsEntry("debezium.transforms.t0.type", "io.debezium.transforms.ExtractNewRecordState")
                .containsEntry("quarkus.log.category.\"io.debezium.pipeline.EventDispatcher\".level", "TRACE")
                .containsEntry("quarkus.log.console.json", "false")
                .containsEntry("quarkus.log.level", "INFO")
                .containsEntry("quarkus.log.min-level", "TRACE");
    }

}
