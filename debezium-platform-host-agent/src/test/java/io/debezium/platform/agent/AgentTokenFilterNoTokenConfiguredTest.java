/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import static io.restassured.RestAssured.given;

import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;

/**
 * debezium/dbz#3003: the fail-open branch is gone. With no {@code agent.token} configured (the
 * default test profile, {@code src/test/resources/application.properties}), every request must
 * be rejected, not waved through as "authentication is disabled (development mode)".
 */
@QuarkusTest
class AgentTokenFilterNoTokenConfiguredTest {

    @Test
    void rejectsRequestWhenTokenUnconfigured() {
        given()
                .when()
                .get("/api/agent/status/test")
                .then()
                .statusCode(401);
    }

    @Test
    void rejectsEvenAnEmptyBearerTokenWhenUnconfigured() {
        // An empty expected token must never match an empty presented one; that would reopen the
        // same hole under a different shape.
        given()
                .header("Authorization", "Bearer ")
                .when()
                .get("/api/agent/status/test")
                .then()
                .statusCode(401);
    }
}
