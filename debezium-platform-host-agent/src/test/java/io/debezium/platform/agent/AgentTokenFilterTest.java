/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import static io.restassured.RestAssured.given;

import java.util.Map;

import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;

/**
 * Tests for {@link AgentTokenFilter} bearer token authentication.
 *
 * <p>Uses a test profile that sets {@code agent.token=test-secret-token}
 * to enable token validation during tests.
 */
@QuarkusTest
@TestProfile(AgentTokenFilterTest.TokenEnabledProfile.class)
class AgentTokenFilterTest {

    @Test
    void rejectsRequestWithoutAuthorizationHeader() {
        given()
                .when()
                .get("/api/agent/status/test")
                .then()
                .statusCode(401);
    }

    @Test
    void rejectsRequestWithWrongToken() {
        given()
                .header("Authorization", "Bearer wrong-token")
                .when()
                .get("/api/agent/status/test")
                .then()
                .statusCode(401);
    }

    @Test
    void rejectsRequestWithMalformedHeader() {
        given()
                .header("Authorization", "Basic dXNlcjpwYXNz")
                .when()
                .get("/api/agent/status/test")
                .then()
                .statusCode(401);
    }

    @Test
    void allowsRequestWithCorrectToken() {
        // The endpoint itself may return 404 (no such container),
        // but the point is it does NOT return 401
        given()
                .header("Authorization", "Bearer test-secret-token")
                .when()
                .get("/api/agent/status/test")
                .then()
                .statusCode(org.hamcrest.Matchers.not(401));
    }

    @Test
    void rejectsPostWithoutToken() {
        given()
                .when()
                .post("/api/agent/stop/test")
                .then()
                .statusCode(401);
    }

    /**
     * Test profile that enables token-based authentication.
     */
    public static class TokenEnabledProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("agent.token", "test-secret-token");
        }
    }
}
