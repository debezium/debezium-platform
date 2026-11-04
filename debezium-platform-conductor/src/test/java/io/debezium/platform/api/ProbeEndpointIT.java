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
import io.debezium.platform.IamEnabledTestProfile;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.oidc.server.OidcWiremockTestResource;

/**
 * Guards the {@code /q/*} path-policy precedence rule introduced by debezium/dbz#3003:
 * {@code /q/health,/q/health/*,/q/metrics} must resolve to the more specific {@code permit}
 * policy ahead of the {@code authenticated} policy on {@code /q/*}, in practice {@code /q/openapi}.
 *
 * <p>Neither {@code quarkus-smallrye-health} nor a Prometheus metrics extension is wired into
 * this application yet (the conductor Deployment defines no liveness/readiness probes today;
 * see the IAM design, HLD/LLD §8.1), so there is no real handler behind {@code /q/health*} or
 * {@code /q/metrics} to assert a 200 from. The carve-out is deliberately pre-emptive. What is
 * asserted instead is the auth-layer outcome: a path permitted by the policy reaches routing and
 * 404s there (no matching resource), while a path requiring authentication is rejected with 401
 * before routing is ever reached. That distinction is exactly what the precedence rule buys.
 */
@QuarkusTest
@TestProfile(IamEnabledTestProfile.class)
@QuarkusTestResource(value = OidcWiremockTestResource.class, restrictToAnnotatedClass = true)
class ProbeEndpointIT {

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("/q/health/live is reachable without a credential (permit, not authenticated)")
    void healthLivenessPathIsNotRejectedByAuth() {
        given()
                .when().get("q/health/live")
                .then()
                // No handler is registered yet; 404 proves the request reached routing
                // rather than being rejected by the auth layer (which would be 401).
                .statusCode(404);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("/q/metrics is reachable without a credential (permit, not authenticated)")
    void metricsPathIsNotRejectedByAuth() {
        given()
                .when().get("q/metrics")
                .then()
                .statusCode(404);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("/q/openapi requires authentication, unlike the probe carve-out")
    void openApiRequiresAuthenticationUnlikeProbes() {
        given()
                .when().get("q/openapi")
                .then()
                .statusCode(401);
    }
}
