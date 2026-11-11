/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.logging.Handler;
import java.util.logging.LogRecord;
import java.util.logging.Logger;

import org.jboss.logmanager.ExtLogRecord;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.OidcTestProfile;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.oidc.server.OidcWiremockTestResource;

@QuarkusTest
@TestProfile(OidcAllowlistIT.AllowlistProfile.class)
@QuarkusTestResource(value = OidcWiremockTestResource.class, restrictToAnnotatedClass = true)
class OidcAllowlistIT {

    public static class AllowlistProfile extends OidcTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            var config = new HashMap<>(super.getConfigOverrides());
            config.put("conductor.auth.allowlist.path", "src/test/resources/oidc-allowlist.yml");
            config.put("quarkus.oras.devservices.base-port", "25004");
            return config;
        }
    }

    private final List<String> auditLines = new CopyOnWriteArrayList<>();
    private final Handler auditHandler = new Handler() {
        @Override
        public void publish(LogRecord record) {
            auditLines.add(record instanceof ExtLogRecord ext ? ext.getFormattedMessage() : record.getMessage());
        }

        @Override
        public void flush() {
        }

        @Override
        public void close() {
        }
    };

    @BeforeEach
    void captureAudit() {
        Logger.getLogger("io.debezium.platform.audit").addHandler(auditHandler);
    }

    @AfterEach
    void releaseAudit() {
        Logger.getLogger("io.debezium.platform.audit").removeHandler(auditHandler);
    }

    @Test
    @DisplayName("An allowlisted, verified email is allowed, regardless of case")
    void allowlistedUserIsAllowed() {
        given().auth().oauth2(token("alice@example.com", "true"))
                .when().get("api/catalog")
                .then().statusCode(200);
    }

    @Test
    @DisplayName("An authenticated user missing from the allowlist is forbidden")
    void unlistedUserIsForbidden() {
        given().auth().oauth2(token("eve@example.com", "true"))
                .when().get("api/catalog")
                .then().statusCode(403);

        assertThat(auditLines).anyMatch(l -> l.contains("user=eve@example.com event=access_denied reason=not_in_allowlist"));
    }

    @Test
    @DisplayName("An allowlisted email that is not verified is forbidden")
    void unverifiedEmailIsForbidden() {
        given().auth().oauth2(token("alice@example.com", "false"))
                .when().get("api/catalog")
                .then().statusCode(403);
    }

    @Test
    @DisplayName("/api/auth/me tells a denied user who they are, with 403")
    void meReportsDeniedUser() {
        given().auth().oauth2(token("eve@example.com", "true"))
                .when().get("api/auth/me")
                .then().statusCode(403).body("email", equalTo("eve@example.com"));
    }

    @Test
    @DisplayName("Mutating calls are audited with the caller's email, without the request body")
    void mutatingCallIsAudited() {
        given().auth().oauth2(token("alice@example.com", "true"))
                .when().delete("api/sources/999999");

        assertThat(auditLines).anyMatch(l -> l.startsWith("AUDIT user=alice@example.com action=DELETE path=/api/sources/999999 status="));
    }

    @Test
    @DisplayName("Login is audited and redirects to the requested local path")
    void loginIsAuditedAndRedirects() {
        given().auth().oauth2(token("alice@example.com", "true"))
                .redirects().follow(false)
                .when().get("api/auth/login?redirect=/pipelines")
                .then().statusCode(303).header("Location", "/pipelines");

        assertThat(auditLines).contains("AUDIT user=alice@example.com event=login");
    }

    private static String token(String email, String verified) {
        return OidcWiremockTestResource.generateJwtToken("alice", Set.of(), "123456", "Bearer",
                Set.of("https://server.example.com"), Map.of("email", email, "email_verified", verified));
    }
}
