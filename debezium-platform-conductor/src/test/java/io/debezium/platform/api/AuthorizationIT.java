/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.not;

import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import io.debezium.doc.FixFor;
import io.debezium.platform.IamEnabledTestProfile;
import io.debezium.platform.config.security.DefaultRoleMappings;
import io.debezium.platform.config.security.Permission;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.oidc.server.OidcWiremockTestResource;

/**
 * Authorization enforcement end to end (debezium/dbz#3003), against the shipped default role
 * bundles and a representative endpoint per permission in the catalogue.
 *
 * <p>Parameterised over {@link Permission#all()} so a new permission added to the catalogue
 * without a corresponding case here fails the build (see {@link #endpointFor(Permission)}).
 * Each representative action targets a non-existent id where the HTTP method allows it, so the
 * test asserts only the authorization outcome (403 or not), never a particular success body.
 */
@QuarkusTest
@TestProfile(IamEnabledTestProfile.class)
@QuarkusTestResource(value = OidcWiremockTestResource.class, restrictToAnnotatedClass = true)
class AuthorizationIT {

    private static final long MISSING_ID = 999_999L;

    @ParameterizedTest
    @EnumSource(Permission.class)
    @FixFor("debezium/dbz#3003")
    void grantedPermissionAllowsEndpoint(Permission permission) {
        Endpoint endpoint = endpointFor(permission);

        requestAs(endpoint, adminToken())
                .then()
                // dmp-admin holds every permission; the endpoint must not reject it as forbidden.
                // The concrete outcome otherwise depends on fixture data (e.g. 404 for a
                // non-existent id), which is deliberately not asserted here.
                .statusCode(not(403));
    }

    @ParameterizedTest
    @EnumSource(Permission.class)
    @FixFor("debezium/dbz#3003")
    void missingPermissionIsForbidden(Permission permission) {
        Endpoint endpoint = endpointFor(permission);

        requestAs(endpoint, noPermissionsToken())
                .then()
                .statusCode(403);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void noTokenIsUnauthorized() {
        given()
                .when().get("api/pipelines")
                .then()
                .statusCode(401);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void unverifiableTokenIsUnauthorized() {
        String unverifiableToken = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJtYWxsb3J5In0.bm90LWEtc2lnbmF0dXJl";

        given()
                .auth().oauth2(unverifiableToken)
                .when().get("api/pipelines")
                .then()
                .statusCode(401);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("dmp-operator can send a signal: the reason the operator role exists")
    void operatorCanSendSignal() {
        given()
                .auth().oauth2(tokenFor("carol", DefaultRoleMappings.OPERATOR))
                .contentType("application/json")
                .body("{\"id\":\"sig-1\",\"type\":\"test\"}")
                .when().post("api/pipelines/" + MISSING_ID + "/signals")
                .then()
                .statusCode(not(403));
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("dmp-operator cannot update a pipeline: operate must not imply write")
    void operatorCannotUpdatePipeline() {
        given()
                .auth().oauth2(tokenFor("carol", DefaultRoleMappings.OPERATOR))
                .contentType("application/json")
                // A structurally valid body, so the denial is unambiguously the permission
                // check and not an incidental 400 from request validation.
                .body("{\"name\":\"x\",\"logLevel\":\"INFO\"}")
                .when().put("api/pipelines/" + MISSING_ID)
                .then()
                .statusCode(403);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("dmp-operator cannot read vaults")
    void operatorCannotReadVaults() {
        given()
                .auth().oauth2(tokenFor("carol", DefaultRoleMappings.OPERATOR))
                .when().get("api/vaults")
                .then()
                .statusCode(403);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void viewerCannotDeletePipeline() {
        given()
                .auth().oauth2(tokenFor("bob", DefaultRoleMappings.VIEWER))
                .when().delete("api/pipelines/" + MISSING_ID)
                .then()
                .statusCode(403);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("dmp-editor cannot write vaults: vault:write is admin-only")
    void editorCannotWriteVaults() {
        given()
                .auth().oauth2(tokenFor("alice", DefaultRoleMappings.EDITOR))
                .when().delete("api/vaults/" + MISSING_ID)
                .then()
                .statusCode(403);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("dmp-editor cannot write alert channels: they can embed outbound credentials")
    void editorCannotWriteAlertChannels() {
        given()
                .auth().oauth2(tokenFor("alice", DefaultRoleMappings.EDITOR))
                .when().delete("api/alerts/channels/" + MISSING_ID)
                .then()
                .statusCode(403);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void adminCanDoEverything() {
        given()
                .auth().oauth2(adminToken())
                .when().delete("api/vaults/" + MISSING_ID)
                .then()
                .statusCode(not(403));
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("Egress endpoints require the write permission of their resource, not read")
    void egressEndpointsRequireWritePermission() {
        String readOnlyToken = tokenFor("bob", DefaultRoleMappings.VIEWER);

        // No request body, so the result isolates the permission check from validation ordering.
        given()
                .auth().oauth2(readOnlyToken)
                .when().post("api/alerts/channels/" + MISSING_ID + "/test")
                .then()
                .statusCode(403);

        given()
                .auth().oauth2(readOnlyToken)
                .contentType("application/json")
                .body("{\"connectionId\":1,\"fullyQualifiedTableName\":\"x\"}")
                .when().post("api/sources/signals/verify")
                .then()
                .statusCode(403);

        given()
                .auth().oauth2(readOnlyToken)
                .contentType("application/json")
                .body("{\"name\":\"x\",\"type\":\"POSTGRESQL\"}")
                .when().post("api/connections/validate")
                .then()
                .statusCode(403);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("Streaming endpoints are enforced like any other endpoint")
    void streamingEndpointsAreEnforced() {
        // Exercises the non-streaming /progress endpoint rather than /progress/stream: REST
        // Assured has no convenient SSE client, and both carry the identical
        // @PermissionsAllowed(MONITORING_READ) annotation, so the enforcement outcome is the same.
        given()
                .auth().oauth2(noPermissionsToken())
                .when().get("api/pipelines/" + MISSING_ID + "/snapshots/progress")
                .then()
                .statusCode(403);
    }

    /**
     * One representative endpoint per permission, chosen so the request body (if any) is valid
     * and the target id does not exist, isolating the authorization outcome from fixture state.
     */
    private static Endpoint endpointFor(Permission permission) {
        return switch (permission) {
            case SOURCE_READ -> Endpoint.get("api/sources");
            case SOURCE_WRITE -> Endpoint.delete("api/sources/" + MISSING_ID);
            case DESTINATION_READ -> Endpoint.get("api/destinations");
            case DESTINATION_WRITE -> Endpoint.delete("api/destinations/" + MISSING_ID);
            case TRANSFORM_READ -> Endpoint.get("api/transforms");
            case TRANSFORM_WRITE -> Endpoint.delete("api/transforms/" + MISSING_ID);
            case CONNECTION_READ -> Endpoint.get("api/connections");
            case CONNECTION_WRITE -> Endpoint.delete("api/connections/" + MISSING_ID);
            case VAULT_READ -> Endpoint.get("api/vaults");
            case VAULT_WRITE -> Endpoint.delete("api/vaults/" + MISSING_ID);
            case PIPELINE_READ -> Endpoint.get("api/pipelines");
            case PIPELINE_WRITE -> Endpoint.delete("api/pipelines/" + MISSING_ID);
            case PIPELINE_OPERATE -> Endpoint.post("api/pipelines/" + MISSING_ID + "/signals",
                    "{\"id\":\"sig-1\",\"type\":\"test\"}");
            case PIPELINE_LOGS -> Endpoint.get("api/pipelines/" + MISSING_ID + "/logs");
            case MONITORING_READ -> Endpoint.get("api/monitoring/panels");
            case ALERT_READ -> Endpoint.get("api/alerts/events");
            case ALERT_WRITE -> Endpoint.delete("api/alerts/rules/" + MISSING_ID);
            case CATALOG_READ -> Endpoint.get("api/catalog");
        };
    }

    private static io.restassured.response.Response requestAs(Endpoint endpoint, String token) {
        var request = given().auth().oauth2(token);
        if (endpoint.body != null) {
            request = request.contentType("application/json").body(endpoint.body);
        }
        return switch (endpoint.method) {
            case GET -> request.when().get(endpoint.path);
            case POST -> request.when().post(endpoint.path);
            case DELETE -> request.when().delete(endpoint.path);
        };
    }

    private static String adminToken() {
        return tokenFor("dave", DefaultRoleMappings.ADMIN);
    }

    private static String noPermissionsToken() {
        // "finance-team" deliberately matches no configured role mapping (FR-5/FR-38): an
        // authenticated caller with zero permissions, not an error.
        return tokenFor("erin", "finance-team");
    }

    private static String tokenFor(String user, String role) {
        return OidcWiremockTestResource.getAccessToken(user, Set.of(role));
    }

    private enum Method {
        GET,
        POST,
        DELETE
    }

    private record Endpoint(Method method, String path, String body) {

        static Endpoint get(String path) {
            return new Endpoint(Method.GET, path, null);
        }

        static Endpoint post(String path, String body) {
            return new Endpoint(Method.POST, path, body);
        }

        static Endpoint delete(String path) {
            return new Endpoint(Method.DELETE, path, null);
        }
    }
}
