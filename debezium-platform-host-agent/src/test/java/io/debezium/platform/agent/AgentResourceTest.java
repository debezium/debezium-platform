/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

/** Tests the HTTP validation and response mapping in {@link AgentResource}. */
@QuarkusTest
class AgentResourceTest {

    @InjectMock
    AgentContainerService containerService;

    @Test
    void deployReturns202Accepted() {
        given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "containerName": "test-pipeline",
                          "image": "quay.io/debezium/server:latest",
                          "port": 9000,
                          "configContent": "debezium.sink.type=kafka"
                        }
                        """)
                .when()
                .post("/api/agent/deploy")
                .then()
                .statusCode(202);
    }

    @Test
    void rejectsContainerNameThatCouldEscapeAgentDirectories() {
        given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "containerName": "../outside",
                          "image": "quay.io/debezium/server:latest",
                          "port": 9000,
                          "configContent": "debezium.sink.type=kafka"
                        }
                        """)
                .when()
                .post("/api/agent/deploy")
                .then()
                .statusCode(400);

        verifyNoInteractions(containerService);
    }

    @Test
    void rejectsInvalidPathContainerNameBeforeCallingTheService() {
        given()
                .when()
                .get("/api/agent/status/bad%20name")
                .then()
                .statusCode(400);

        verifyNoInteractions(containerService);
    }

    @Test
    void rejectsInvalidDeployFieldsBeforeCallingTheService() {
        given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "containerName": "test-pipeline",
                          "image": "",
                          "port": 0,
                          "configContent": null
                        }
                        """)
                .when()
                .post("/api/agent/deploy")
                .then()
                .statusCode(400);

        verifyNoInteractions(containerService);
    }

    @Test
    void undeployUsesContainerNamePathParameter() {
        given()
                .when()
                .post("/api/agent/undeploy/test-pipeline")
                .then()
                .statusCode(204);
    }

    @Test
    void stopReturns500ForServiceFailure() {
        doThrow(new AgentOperationException("Docker did not stop"))
                .when(containerService).stop("test-pipeline");

        given()
                .when()
                .post("/api/agent/stop/test-pipeline")
                .then()
                .statusCode(500);
    }

    @Test
    void startUsesContainerNamePathParameter() {
        given()
                .when()
                .post("/api/agent/start/test-pipeline")
                .then()
                .statusCode(204);
    }

    @Test
    void statusReturnsTheServiceResponse() {
        when(containerService.status("test-pipeline"))
                .thenReturn(Optional.of(new ContainerStatus(true, "config-hash")));

        given()
                .when()
                .get("/api/agent/status/test-pipeline")
                .then()
                .statusCode(200)
                .body("running", equalTo(true))
                .body("configHash", equalTo("config-hash"));
    }

    @Test
    void statusReturns404WhenServiceHasNoContainer() {
        when(containerService.status("missing-pipeline")).thenReturn(Optional.empty());

        given()
                .when()
                .get("/api/agent/status/missing-pipeline")
                .then()
                .statusCode(404);
    }

    @Test
    void logsReturnsTheServiceOutput() {
        when(containerService.logs("test-pipeline")).thenReturn("Starting Debezium Server");

        given()
                .when()
                .get("/api/agent/logs/test-pipeline")
                .then()
                .statusCode(200)
                .body(equalTo("Starting Debezium Server"));
    }
}
