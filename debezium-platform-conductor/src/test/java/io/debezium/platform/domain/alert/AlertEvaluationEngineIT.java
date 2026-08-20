/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;

import org.awaitility.Awaitility;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import io.debezium.platform.environment.monitoring.AlertEvaluationTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;

@QuarkusTest
@QuarkusTestResource(value = AlertEvaluationTestResource.class, restrictToAnnotatedClass = true)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AlertEvaluationEngineIT {

    private static final String RULES_PATH = "api/alerts/rules";
    private static final String EVENTS_PATH = "api/alerts/events";
    private static final String STATUS_PATH = "api/alerts/status";

    private static final HttpClient HTTP = HttpClient.newHttpClient();

    static Long immediateRuleId;
    static Long pendingRuleId;

    @ConfigProperty(name = "test.metrics-endpoint.port", defaultValue = "0")
    int metricsPort;

    @Inject
    EntityManager em;

    @Inject
    UserTransaction tx;

    void setSourceLag(double value) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + metricsPort + "/control/source-lag?value=" + value))
                .method("PUT", HttpRequest.BodyPublishers.noBody())
                .build();
        HTTP.send(req, HttpResponse.BodyHandlers.discarding());
    }

    void clearSourceLag() throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + metricsPort + "/control/source-lag"))
                .DELETE()
                .build();
        HTTP.send(req, HttpResponse.BodyHandlers.discarding());
    }

    @Test
    @Order(-1)
    void cleanupLeftoverData() throws Exception {
        tx.begin();
        try {
            List<String> ruleNames = List.of("e2e-immediate-alert", "e2e-pending-alert");
            em.createQuery("DELETE FROM alert_state s WHERE s.rule.name IN (:names)")
                    .setParameter("names", ruleNames)
                    .executeUpdate();
            em.createQuery("DELETE FROM alert_event e WHERE e.ruleName IN (:names)")
                    .setParameter("names", ruleNames)
                    .executeUpdate();
            em.createQuery("DELETE FROM alert_rule r WHERE r.name IN (:names)")
                    .setParameter("names", ruleNames)
                    .executeUpdate();
            tx.commit();
        }
        catch (Exception e) {
            tx.rollback();
            throw e;
        }

        clearSourceLag();
    }

    @Test
    @Order(0)
    void createAlertRules() {
        immediateRuleId = given()
                .contentType(ContentType.JSON)
                .body(Map.ofEntries(
                        Map.entry("name", "e2e-immediate-alert"),
                        Map.entry("panelId", "source-lag"),
                        Map.entry("operator", "GREATER_THAN"),
                        Map.entry("threshold", 5.0),
                        Map.entry("severity", "WARNING"),
                        Map.entry("forDuration", "PT0S"),
                        Map.entry("reduceFunction", "LAST"),
                        Map.entry("evaluationWindow", "PT5M"),
                        Map.entry("enabled", true)))
                .when().post(RULES_PATH)
                .then()
                .statusCode(201)
                .body("name", is("e2e-immediate-alert"))
                .body("panelId", is("source-lag"))
                .extract().jsonPath().getLong("id");

        pendingRuleId = given()
                .contentType(ContentType.JSON)
                .body(Map.ofEntries(
                        Map.entry("name", "e2e-pending-alert"),
                        Map.entry("panelId", "source-lag"),
                        Map.entry("operator", "GREATER_THAN"),
                        Map.entry("threshold", 5.0),
                        Map.entry("severity", "CRITICAL"),
                        Map.entry("forDuration", "PT5S"),
                        Map.entry("reduceFunction", "LAST"),
                        Map.entry("evaluationWindow", "PT5M"),
                        Map.entry("enabled", true)))
                .when().post(RULES_PATH)
                .then()
                .statusCode(201)
                .body("name", is("e2e-pending-alert"))
                .extract().jsonPath().getLong("id");
    }

    @Test
    @Order(1)
    void statusIsIdleBeforeThresholdExceeded() throws Exception {
        setSourceLag(1.0);

        Awaitility.await()
                .atMost(Duration.ofSeconds(15))
                .pollInterval(Duration.ofSeconds(2))
                .untilAsserted(() -> given()
                        .when().get(STATUS_PATH)
                        .then()
                        .statusCode(200)
                        .body("totalFiring", is(0))
                        .body("totalPending", is(0)));
    }

    @Test
    @Order(2)
    void immediateRuleFiresAndPendingRuleEntersPending() throws Exception {
        setSourceLag(10.0);

        Awaitility.await()
                .atMost(Duration.ofSeconds(15))
                .pollInterval(Duration.ofSeconds(2))
                .untilAsserted(() -> given()
                        .when().get(STATUS_PATH)
                        .then()
                        .statusCode(200)
                        .body("totalFiring", is(1))
                        .body("totalPending", is(1))
                        .body("firingBySeverity.WARNING", is(1)));
    }

    @Test
    @Order(3)
    void pendingRuleTransitionsToFiring() {
        Awaitility.await()
                .atMost(Duration.ofSeconds(15))
                .pollInterval(Duration.ofSeconds(2))
                .untilAsserted(() -> given()
                        .when().get(STATUS_PATH)
                        .then()
                        .statusCode(200)
                        .body("totalFiring", is(2))
                        .body("totalPending", is(0))
                        .body("firingBySeverity.WARNING", is(1))
                        .body("firingBySeverity.CRITICAL", is(1)));
    }

    @Test
    @Order(4)
    void firingEventsAreCreated() {
        given()
                .queryParam("status", "firing")
                .when().get(EVENTS_PATH)
                .then()
                .statusCode(200)
                .body("totalElements", is(2))
                .body("events", hasSize(2));
    }

    @Test
    @Order(5)
    void alertsResolveWhenValueDropsBelowThreshold() throws Exception {
        setSourceLag(1.0);

        Awaitility.await()
                .atMost(Duration.ofSeconds(15))
                .pollInterval(Duration.ofSeconds(2))
                .untilAsserted(() -> given()
                        .when().get(STATUS_PATH)
                        .then()
                        .statusCode(200)
                        .body("totalFiring", is(0))
                        .body("totalPending", is(0)));
    }

    @Test
    @Order(6)
    void resolvedEventsExist() {
        given()
                .queryParam("status", "resolved")
                .when().get(EVENTS_PATH)
                .then()
                .statusCode(200)
                .body("totalElements", greaterThanOrEqualTo(2))
                .body("events[0].resolvedAt", notNullValue());
    }

    @Test
    @Order(7)
    void activeAlertsListIsEmpty() {
        given()
                .when().get(STATUS_PATH)
                .then()
                .statusCode(200)
                .body("activeAlerts", empty());
    }

    @Test
    @Order(99)
    void cleanupTestData() throws Exception {
        clearSourceLag();

        tx.begin();
        try {
            List<String> ruleNames = List.of("e2e-immediate-alert", "e2e-pending-alert");
            em.createQuery("DELETE FROM alert_state s WHERE s.rule.name IN (:names)")
                    .setParameter("names", ruleNames)
                    .executeUpdate();
            em.createQuery("DELETE FROM alert_event e WHERE e.ruleName IN (:names)")
                    .setParameter("names", ruleNames)
                    .executeUpdate();
            em.createQuery("DELETE FROM alert_rule r WHERE r.name IN (:names)")
                    .setParameter("names", ruleNames)
                    .executeUpdate();
            tx.commit();
        }
        catch (Exception e) {
            tx.rollback();
            throw e;
        }
    }
}
