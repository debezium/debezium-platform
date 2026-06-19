/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.watcher.consumers;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import java.time.Duration;
import java.time.temporal.ChronoUnit;

import org.awaitility.Awaitility;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import io.debezium.doc.FixFor;
import io.debezium.operator.api.model.DebeziumServer;
import io.debezium.platform.OutboxTestProfile;
import io.debezium.platform.environment.operator.actions.DebeziumKubernetesAdapter;
import io.debezium.platform.util.TestDatasourceHelper;
import io.fabric8.kubernetes.client.server.mock.EnableKubernetesMockClient;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@TestProfile(OutboxTestProfile.class)
@EnableKubernetesMockClient(crud = true)
class OutboxEventConsumerResilienceIT {

    @InjectMock
    DebeziumKubernetesAdapter k8sAdapter;

    @ConfigProperty(name = "quarkus.datasource.jdbc.url")
    String datasourceUrl;

    Long sourceId;
    Long destinationId;
    String resourceSuffix;

    @BeforeEach
    void setUp() {
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
                    "description": "Test source",
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
                  "description": "Test destination",
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
    }

    @Test
    @FixFor("debezium/dbz#2123")
    @DisplayName("Engine should continue processing outbox events after a non-retriable deployment error")
    void engineShouldContinueProcessingAfterNonRetriableError() {

        var captor = ArgumentCaptor.forClass(DebeziumServer.class);
        var failingPipelineName = "pipeline-failing-" + resourceSuffix;
        var succeedingPipelineName = "pipeline-succeeding-" + resourceSuffix;

        doAnswer(invocation -> {
            DebeziumServer ds = invocation.getArgument(0);
            if (ds.getMetadata().getName().equals(failingPipelineName)) {
                throw new NullPointerException("Cannot invoke \"java.util.Map.size()\" because \"m\" is null");
            }
            return null;
        }).when(k8sAdapter).deployPipeline(any());

        createResource("api/pipelines", """
                {
                   "name": "%s",
                   "description": "This pipeline will fail during deployment",
                   "source": {
                     "id": %s,
                     "name": "test-source-%s"
                   },
                   "destination": {
                     "id": %s,
                     "name": "test-destination-%s"
                   },
                   "transforms": [],
                   "logLevel": "INFO",
                   "logLevels": {}
                 }""".formatted(failingPipelineName, sourceId, resourceSuffix, destinationId, resourceSuffix));

        createResource("api/pipelines", """
                {
                   "name": "%s",
                   "description": "This pipeline should still be deployed",
                   "source": {
                     "id": %s,
                     "name": "test-source-%s"
                   },
                   "destination": {
                     "id": %s,
                     "name": "test-destination-%s"
                   },
                   "transforms": [],
                   "logLevel": "INFO",
                   "logLevels": {}
                 }""".formatted(succeedingPipelineName, sourceId, resourceSuffix, destinationId, resourceSuffix));

        Awaitility.await()
                .atMost(Duration.of(120, ChronoUnit.SECONDS))
                .pollDelay(Duration.of(100, ChronoUnit.MILLIS))
                .pollInterval(Duration.of(500, ChronoUnit.MILLIS))
                .untilAsserted(() -> {
                    Mockito.verify(k8sAdapter, Mockito.atLeast(2)).deployPipeline(captor.capture());
                    assertThat(captor.getAllValues().stream()
                            .anyMatch(ds -> ds.getMetadata().getName().equals(succeedingPipelineName)))
                            .as("Second pipeline should have been deployed despite the first one failing")
                            .isTrue();
                });
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
}
