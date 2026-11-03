/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;

import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.doc.FixFor;
import io.debezium.platform.IamEnabledTestProfile;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.oidc.server.OidcWiremockTestResource;

@QuarkusTest
@TestProfile(IamEnabledTestProfile.class)
@QuarkusTestResource(value = OidcWiremockTestResource.class, restrictToAnnotatedClass = true)
class OidcSecurityIT {

    @Test
    @DisplayName("Calling an API endpoint without a bearer token should be rejected")
    void apiRequestWithoutTokenShouldReturnUnauthorized() {
        given()
                .when().get("api/catalog")
                .then()
                .statusCode(401);
    }

    @Test
    @DisplayName("Calling an API endpoint with a valid, authorized bearer token should be allowed")
    void apiRequestWithValidTokenShouldReturnOk() {
        // debezium/dbz#3003: authentication alone is no longer sufficient; dmp-viewer is one of
        // the shipped default bundles and holds catalog:read.
        String accessToken = OidcWiremockTestResource.getAccessToken("alice", Set.of("dmp-viewer"));

        given()
                .auth().oauth2(accessToken)
                .when().get("api/catalog")
                .then()
                .statusCode(200);
    }

    @Test
    @DisplayName("A token failing verification should be rejected, not surfaced as a server error")
    void apiRequestWithInvalidTokenShouldReturnUnauthorized() {
        // Structurally a JWT so verification stays local (JWKS); an opaque value would instead
        // send quarkus-oidc down the introspection path, which the mock issuer does not stub.
        String unverifiableToken = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJtYWxsb3J5In0.bm90LWEtc2lnbmF0dXJl";

        given()
                .auth().oauth2(unverifiableToken)
                .when().get("api/catalog")
                .then()
                .statusCode(401);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("/q/openapi now requires authentication, like /api/*")
    void infraEndpointRequiresAuthentication() {
        given()
                .when().get("q/openapi")
                .then()
                .statusCode(401);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("/q/openapi accepts any authenticated caller, no permission required")
    void infraEndpointAcceptsAnyValidToken() {
        String accessToken = OidcWiremockTestResource.getAccessToken("alice", Set.of("dmp-user"));

        given()
                .auth().oauth2(accessToken)
                .when().get("q/openapi")
                .then()
                .statusCode(200);
    }
}