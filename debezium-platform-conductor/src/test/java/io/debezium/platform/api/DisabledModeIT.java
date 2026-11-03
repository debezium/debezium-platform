/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.doc.FixFor;
import io.quarkus.test.junit.QuarkusTest;

/**
 * With IAM at its default (off), every endpoint remains reachable without a credential, and a
 * presented token changes nothing (debezium/dbz#3003). Default profile, deliberately no
 * {@code @TestProfile}: this is what every existing deployment sees today, unchanged (NFR-5).
 */
@QuarkusTest
class DisabledModeIT {

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("Every guarded endpoint is reachable without a credential when IAM is off")
    void allEndpointsReachableWithoutToken() {
        given().when().get("api/pipelines").then().statusCode(200);
        given().when().get("api/sources").then().statusCode(200);
        given().when().get("api/destinations").then().statusCode(200);
        given().when().get("api/transforms").then().statusCode(200);
        given().when().get("api/connections").then().statusCode(200);
        given().when().get("api/vaults").then().statusCode(200);
        given().when().get("api/catalog").then().statusCode(200);
        given().when().get("api/alerts/events").then().statusCode(200);
        given().when().get("api/alerts/rules").then().statusCode(200);
        given().when().get("api/alerts/channels").then().statusCode(200);
        given().when().get("api/monitoring/panels").then().statusCode(200);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("A presented token is accepted and simply ignored, not rejected")
    void presentedTokenIsAcceptedAndIgnored() {
        given()
                .auth().oauth2("not-a-real-token-but-iam-is-off")
                .when().get("api/pipelines")
                .then()
                .statusCode(200);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("/api/me reports iamEnabled: false and the universal-wildcard permission set")
    void identityEndpointReportsDisabled() {
        given()
                .when().get("api/me")
                .then()
                .statusCode(200)
                .body("iamEnabled", org.hamcrest.Matchers.is(false))
                .body("permissions", org.hamcrest.Matchers.contains("*"));
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("The internal notification endpoint keeps accepting uncredentialed posts")
    void internalEndpointAcceptsUncredentialedPost() {
        given()
                .contentType("application/json")
                .body("{\"id\":\"n-1\",\"aggregateType\":\"Initial Snapshot\",\"type\":\"COMPLETED\"}")
                .when().post("api/internal/pipelines/999999/notifications")
                .then()
                // No pipeline 999999 exists, so 404; the point is it is not 401/403, proving
                // auth plays no part in disabled mode, exactly as before this feature.
                .statusCode(404);
    }
}
