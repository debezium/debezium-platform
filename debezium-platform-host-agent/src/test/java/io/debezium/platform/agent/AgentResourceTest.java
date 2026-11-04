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

import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;

/**
 * Tests the HTTP validation and response mapping in {@link AgentResource}.
 *
 * <p>debezium/dbz#3003: a token is now required (the fail-open branch in {@link AgentTokenFilter}
 * is gone), so every request here authenticates with the token this profile configures;
 * {@link AgentTokenFilterTest} and {@link AgentTokenFilterNoTokenConfiguredTest} cover the filter
 * itself.
 */
@QuarkusTest
@TestProfile(AgentResourceTest.TokenConfiguredProfile.class)
class AgentResourceTest {

    private static final String TOKEN = "resource-test-token";

    @InjectMock
    AgentContainerService containerService;

    private static RequestSpecification authenticated() {
        return given().header("Authorization", "Bearer " + TOKEN);
    }

    @Test
    void documentsAgentEndpointsInOpenApi() {
        authenticated()
                .accept(ContentType.JSON)
                .when()
                .get("/q/openapi")
                .then()
                .statusCode(200)
                .body("paths.'/api/agent/deploy'.post.summary", equalTo("Deploys a Debezium Server container"))
                .body("paths.'/api/agent/status/{containerName}'.get.responses.200.description", equalTo("Container status"));
    }

    @Test
    void deployReturns202Accepted() {
        authenticated()
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
        authenticated()
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
        authenticated()
                .when()
                .get("/api/agent/status/bad%20name")
                .then()
                .statusCode(400);

        verifyNoInteractions(containerService);
    }

    @Test
    void rejectsInvalidDeployFieldsBeforeCallingTheService() {
        authenticated()
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
        authenticated()
                .when()
                .post("/api/agent/undeploy/test-pipeline")
                .then()
                .statusCode(204);
    }

    @Test
    void stopReturns500ForServiceFailure() {
        doThrow(new AgentOperationException("Docker did not stop"))
                .when(containerService).stop("test-pipeline");

        authenticated()
                .when()
                .post("/api/agent/stop/test-pipeline")
                .then()
                .statusCode(500);
    }

    @Test
    void startUsesContainerNamePathParameter() {
        authenticated()
                .when()
                .post("/api/agent/start/test-pipeline")
                .then()
                .statusCode(204);
    }

    @Test
    void statusReturnsTheServiceResponse() {
        when(containerService.status("test-pipeline"))
                .thenReturn(Optional.of(new ContainerStatus(true, "config-hash")));

        authenticated()
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

        authenticated()
                .when()
                .get("/api/agent/status/missing-pipeline")
                .then()
                .statusCode(404);
    }

    @Test
    void logsReturnsTheServiceOutput() {
        when(containerService.logs("test-pipeline")).thenReturn("Starting Debezium Server");

        authenticated()
                .when()
                .get("/api/agent/logs/test-pipeline")
                .then()
                .statusCode(200)
                .body(equalTo("Starting Debezium Server"));
    }

    public static class TokenConfiguredProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("agent.token", TOKEN);
        }
    }
}
