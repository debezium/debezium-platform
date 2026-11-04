/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;
import static org.hamcrest.Matchers.not;

import java.util.Set;

import jakarta.inject.Inject;

import org.junit.jupiter.api.Test;

import io.debezium.doc.FixFor;
import io.debezium.platform.InternalCredentialEnforcedTestProfile;
import io.debezium.platform.domain.InternalCredentialService;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.oidc.server.OidcWiremockTestResource;

/**
 * End-to-end coverage of {@code /api/internal/*} with {@code InternalCredentialFilter}
 * enforcement actually active (debezium/dbz#3003): {@code conductor.security.enabled=true} and
 * {@code conductor.security.internal-credential.secret} configured.
 *
 * <p>This is the one suite that posts a real credential to a real internal path with IAM on. It
 * exists because every other IAM-enabled suite ({@code AuthorizationIT}, {@code OidcSecurityIT})
 * targets ordinary user-facing endpoints, and {@code SnapshotNotificationReceiverIT} declares no
 * {@code @TestProfile} and so runs IAM-off: nothing else would have caught two real defects this
 * class guards against going forward:
 *
 * <ul>
 * <li>Quarkus's proactive authentication (on by default) runs every registered authentication
 * mechanism, including {@code quarkus-oidc}'s JWT parser, against any request carrying an
 * {@code Authorization: Bearer} value before routing ever reaches a JAX-RS filter, regardless of
 * the {@code permit} path policy on {@code /api/internal/*}. The internal credential is not a
 * JWT, so without {@code quarkus.http.auth.proactive=false} every one of these requests was
 * rejected before {@code InternalCredentialFilter} ran at all once IAM was enabled.</li>
 * <li>Gating the filter on {@code InternalCredentialService.isConfigured()} rather than
 * {@code isEnforcementActive()} would activate real HMAC verification the moment the secret is
 * set, which is exactly what DDD-79's upgrade runbook for existing deployments depends on
 * <em>not</em> happening until every pipeline has been redeployed to carry the credential.</li>
 * </ul>
 */
@QuarkusTest
@TestProfile(InternalCredentialEnforcedTestProfile.class)
@QuarkusTestResource(value = OidcWiremockTestResource.class, restrictToAnnotatedClass = true)
class InternalCredentialIT {

    private static final long PIPELINE_ID = 1L;
    private static final long OTHER_PIPELINE_ID = 2L;

    @Inject
    InternalCredentialService internalCredentialService;

    @Test
    @FixFor("debezium/dbz#3003")
    void validCredentialIsAcceptedAtInternalPath() {
        // Not asserting 202: PIPELINE_ID need not exist for this, only the auth outcome does
        // (same convention as AuthorizationIT). A 401 here means either defect in the class
        // Javadoc reproduced: proactive authentication intercepting the request, or enforcement
        // never actually switching on.
        given()
                .header("Authorization", internalCredentialService.mintAuthorizationHeader(PIPELINE_ID))
                .contentType(APPLICATION_JSON)
                .body(notification())
                .when().post(notificationsPath(PIPELINE_ID))
                .then()
                .statusCode(not(401));
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void missingCredentialIsRejectedAtInternalPath() {
        given()
                .contentType(APPLICATION_JSON)
                .body(notification())
                .when().post(notificationsPath(PIPELINE_ID))
                .then()
                .statusCode(401);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void credentialMintedForAnotherPipelineIsRejected() {
        given()
                .header("Authorization", internalCredentialService.mintAuthorizationHeader(OTHER_PIPELINE_ID))
                .contentType(APPLICATION_JSON)
                .body(notification())
                .when().post(notificationsPath(PIPELINE_ID))
                .then()
                .statusCode(401);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void userTokenIsRejectedAtInternalPath() {
        String userToken = OidcWiremockTestResource.getAccessToken("alice", Set.of("dmp-admin"));

        given()
                .auth().oauth2(userToken)
                .contentType(APPLICATION_JSON)
                .body(notification())
                .when().post(notificationsPath(PIPELINE_ID))
                .then()
                .statusCode(401);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void internalCredentialIsRejectedAtAUserPath() {
        given()
                .header("Authorization", internalCredentialService.mintAuthorizationHeader(PIPELINE_ID))
                .when().get("api/catalog")
                .then()
                .statusCode(401);
    }

    private static String notificationsPath(long pipelineId) {
        return "api/internal/pipelines/" + pipelineId + "/notifications";
    }

    private static String notification() {
        return """
                {
                  "id": "n-it",
                  "aggregateType": "Initial Snapshot",
                  "type": "STARTED",
                  "additionalData": {},
                  "timestamp": 1758535200000
                }
                """;
    }
}
