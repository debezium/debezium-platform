/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;

import java.time.Duration;
import java.time.temporal.ChronoUnit;

import jakarta.inject.Inject;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.testcontainers.shaded.org.awaitility.Awaitility;

import io.debezium.operator.api.model.DebeziumServer;
import io.debezium.platform.MockedTestProfile;
import io.debezium.platform.environment.operator.actions.DebeziumKubernetesAdapter;
import io.debezium.platform.util.TestDatasourceHelper;
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

    @ConfigProperty(name = "quarkus.datasource.jdbc.url")
    String datasourceUrl;

    ArgumentCaptor<DebeziumServer> debeziumServerArgumentCaptor;
    Long sourceId;
    Long destinationId;
    Long transformId;
    String resourceSuffix;

    @BeforeEach
    void setUp() {

        debeziumServerArgumentCaptor = ArgumentCaptor.forClass(DebeziumServer.class);
        Mockito.reset(k8sAdapter);
        resourceSuffix = String.valueOf(System.nanoTime());

        TestDatasourceHelper dbHelper = TestDatasourceHelper.parsePostgresJdbcUrl(datasourceUrl);

        Long sourceConnectionId = createResource("api/connections", """
                {
                       "name": "postgres-connection-%s",
                       "type": "POSTGRESQL",
                       "config": {
                         "hostname": "postgresql",
                         "port": %s,
                         "username": "debezium",
                         "password": "debezium",
                         "database": "debezium"
                       }
                     }
                  }""".formatted(resourceSuffix, dbHelper.getPort()));

        Long destinationConnectionId = createResource("api/connections", """
                {
                     "name": "kafka-connection-%s",
                     "type": "KAFKA",
                     "config": {
                       "bootstrap.servers": "dbz-kafka-kafka-bootstrap.debezium-platform:9092"
                     }
                   }""".formatted(resourceSuffix));

        sourceId = createResource("api/sources", """
                {
                    "name": "test-source-%s",
                    "description": "Yummy data source",
                    "type": "io.debezium.connector.postgresql.PostgresConnector",
                    "schema": "dummy",
                    "vaults": [],
                    "connection": {
                        "id": %s
                    },
                    "config": {
                      "topic.prefix": "inventory",
                      "schema.include.list": "inventory"
                    }
                  }""".formatted(resourceSuffix, sourceConnectionId));

        destinationId = createResource("api/destinations", """
                 {
                  "name": "test-destination-%s",
                  "type": "kafka",
                  "description": "Some funny destination",
                  "schema": "dummy",
                  "vaults": [],
                   "connection": {
                        "id": %s
                    },
                  "config": {
                    "producer.key.serializer": "org.apache.kafka.common.serialization.StringSerializer",
                    "producer.value.serializer": "org.apache.kafka.common.serialization.StringSerializer"
                  }
                }""".formatted(resourceSuffix, destinationConnectionId));

        transformId = createResource("api/transforms", """
                {
                   "name": "Debezium marker %s",
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
                 }""".formatted(resourceSuffix));
    }

    private static Long createResource(String path, String body) {

        Number id = given()
                .header("Content-Type", "application/json")
                .body(body).when().post(path)
                .then()
                .statusCode(201)
                .extract()
                .path("id");

        return id.longValue();
    }

    @Test
    @DisplayName("When a pipeline is created then a debezium server instance must be created on the environment")
    void createPipeline() {

        String jsonBody = """
                {
                   "name": "test-pipeline",
                   "description": "It goes from here to there!",
                   "source": {
                     "id": %s,
                     "name": "test-source-%s"
                   },
                   "destination": {
                     "id": %s,
                     "name": "test-destination-%s"
                   },
                   "transforms": [
                     {
                        "name": "ExtractRecords",
                        "id": %s
                     }
                   ],
                   "logLevel": "INFO",
                   "logLevels": {
                     "io.debezium.pipeline.EventDispatcher": "TRACE"
                   }
                 }""".formatted(sourceId, resourceSuffix, destinationId, resourceSuffix, transformId);

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

        TestDatasourceHelper dbHelper = TestDatasourceHelper.parsePostgresJdbcUrl(datasourceUrl);
        String expectedJdbcUrl = dbHelper.toJdbcUrl("loggerLevel=OFF");
        String expectedPredicateId = "p" + transformId;

        assertThat(debeziumServer.asConfiguration().getAsMapSimple())
                .containsEntry("debezium.api.enabled", "true")
                .containsEntry("debezium.format.header", "json")
                .containsEntry("debezium.format.key", "json")
                .containsEntry("debezium.format.value", "json")
                .containsEntry("debezium.predicates", expectedPredicateId)
                .containsEntry("debezium.predicates." + expectedPredicateId + ".pattern", "inventory.inventory.products")
                .containsEntry("debezium.predicates." + expectedPredicateId + ".type", "org.apache.kafka.connect.transforms.predicates.TopicNameMatches")
                .containsEntry("debezium.sink.kafka.producer.bootstrap.servers", "dbz-kafka-kafka-bootstrap.debezium-platform:9092")
                .containsEntry("debezium.sink.kafka.producer.key.serializer", "org.apache.kafka.common.serialization.StringSerializer")
                .containsEntry("debezium.sink.kafka.producer.value.serializer", "org.apache.kafka.common.serialization.StringSerializer")
                .containsEntry("debezium.sink.type", "kafka")
                .containsEntry("debezium.source.connector.class", "io.debezium.connector.postgresql.PostgresConnector")
                .containsEntry("debezium.source.database.dbname", "debezium")
                .containsEntry("debezium.source.database.hostname", "postgresql")
                .containsEntry("debezium.source.database.password", "debezium")
                .containsEntry("debezium.source.database.port", dbHelper.getPort())
                .containsEntry("debezium.source.database.user", "debezium")
                .containsEntry("debezium.source.notification.enabled.channels", "log")
                .containsEntry("debezium.source.offset.flush.interval.ms", "60000")
                .containsEntry("debezium.source.offset.storage", "io.debezium.storage.jdbc.offset.JdbcOffsetBackingStore")
                .containsEntry("debezium.source.offset.storage.jdbc.offset.table.name", "test_pipeline_offset")
                .containsEntry("debezium.source.offset.storage.jdbc.password", "quarkus")
                .containsEntry("debezium.source.offset.storage.jdbc.url", expectedJdbcUrl)
                .containsEntry("debezium.source.offset.storage.jdbc.user", "quarkus")
                .containsEntry("debezium.source.schema.history.internal", "io.debezium.storage.jdbc.history.JdbcSchemaHistory")
                .containsEntry("debezium.source.schema.history.internal.jdbc.password", "quarkus")
                .containsEntry("debezium.source.schema.history.internal.jdbc.schema.history.table.name", "test_pipeline_schema_history")
                .containsEntry("debezium.source.schema.history.internal.jdbc.url", expectedJdbcUrl)
                .containsEntry("debezium.source.schema.history.internal.jdbc.user", "quarkus")
                .containsEntry("debezium.source.schema.include.list", "inventory")
                .containsEntry("debezium.source.signal.enabled.channels", "source,in-process")
                .containsEntry("debezium.source.topic.prefix", "inventory")
                .containsEntry("debezium.transforms", "t0")
                .containsEntry("debezium.transforms.t0.add.fields", "op")
                .containsEntry("debezium.transforms.t0.add.headers", "db,table")
                .containsEntry("debezium.transforms.t0.negate", "false")
                .containsEntry("debezium.transforms.t0.predicate", expectedPredicateId)
                .containsEntry("debezium.transforms.t0.type", "io.debezium.transforms.ExtractNewRecordState")
                .containsEntry("quarkus.log.category.\"io.debezium.pipeline.EventDispatcher\".level", "TRACE")
                .containsEntry("quarkus.log.console.json", "false")
                .containsEntry("quarkus.log.level", "INFO")
                .containsEntry("quarkus.log.min-level", "TRACE");
    }

    @Test
    @DisplayName("When a pipeline name is not RFC 1123 compliant then pipeline creation must be rejected")
    void rejectInvalidPipelineName() {

        String jsonBody = """
                {
                   "name": "Demo",
                   "description": "It goes from here to there!",
                   "source": {
                     "id": %s,
                     "name": "test-source-%s"
                   },
                   "destination": {
                     "id": %s,
                     "name": "test-destination-%s"
                   },
                   "transforms": [
                     {
                        "name": "ExtractRecords",
                        "id": %s
                     }
                   ],
                   "logLevel": "INFO",
                   "logLevels": {
                     "io.debezium.pipeline.EventDispatcher": "TRACE"
                   }
                 }""".formatted(sourceId, resourceSuffix, destinationId, resourceSuffix, transformId);

        given()
                .header("Content-Type", "application/json")
                .body(jsonBody).when().post("api/pipelines")
                .then()
                .statusCode(400)
                .body("title", is("Constraint Violation"))
                .body("status", is(400))
                .body("violations.field", hasItem("name"))
                .body("violations.message", hasItem("Pipeline name must be a lowercase RFC 1123 subdomain"));
    }

}
