/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;

import java.util.Set;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.doc.FixFor;
import io.debezium.platform.IamEnabledTestProfile;
import io.debezium.platform.config.security.DefaultRoleMappings;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.oidc.server.OidcWiremockTestResource;

@QuarkusTest
@TestProfile(IamEnabledTestProfile.class)
@QuarkusTestResource(value = OidcWiremockTestResource.class, restrictToAnnotatedClass = true)
class IdentityResourceIT {

    @Test
    @FixFor("debezium/dbz#3003")
    void returnsIdentityAndPermissions() {
        String token = OidcWiremockTestResource.getAccessToken("dave", Set.of(DefaultRoleMappings.ADMIN));

        given()
                .auth().oauth2(token)
                .when().get("api/me")
                .then()
                .statusCode(200)
                .body("iamEnabled", org.hamcrest.Matchers.is(true))
                .body("roles", hasItems(DefaultRoleMappings.ADMIN))
                .body("permissions", hasSize(18));
    }

    @Test
    @FixFor("debezium/dbz#3003")
    @DisplayName("Roles with no permission mapping are listed, but contribute no permissions")
    void listsUnmappedRolesButNotAsPermissions() {
        String token = OidcWiremockTestResource.getAccessToken("alice",
                Set.of(DefaultRoleMappings.EDITOR, "finance-team"));

        given()
                .auth().oauth2(token)
                .when().get("api/me")
                .then()
                .statusCode(200)
                .body("roles", hasItems(DefaultRoleMappings.EDITOR, "finance-team"))
                .body("permissions", hasSize(16));
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void reportsEmptyPermissionsForUnmappedUser() {
        String token = OidcWiremockTestResource.getAccessToken("erin", Set.of("finance-team"));

        given()
                .auth().oauth2(token)
                .when().get("api/me")
                .then()
                .statusCode(200)
                .body("iamEnabled", org.hamcrest.Matchers.is(true))
                .body("permissions", empty());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void requiresAuthenticationButNoPermission() {
        // erin holds zero permissions, yet /api/me succeeds: any authenticated caller may ask
        // who they are, no permission required.
        String token = OidcWiremockTestResource.getAccessToken("erin", Set.of("finance-team"));

        given().auth().oauth2(token).when().get("api/me").then().statusCode(200);
        given().when().get("api/me").then().statusCode(401);
    }
}
