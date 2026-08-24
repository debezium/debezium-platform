/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.allOf;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasEntry;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

import java.time.Instant;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;

import org.hamcrest.CoreMatchers;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.AlertStateEntity;
import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.ReduceFunction;
import io.debezium.platform.data.model.Severity;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AlertEventResourceIT {

    private static final String EVENTS_PATH = "api/alerts/events";
    private static final String STATUS_PATH = "api/alerts/status";

    static Long ruleWarningId;
    static Long ruleCriticalId;
    static Long firingEventId;
    static Long resolvedEventId;
    static Long criticalEventId;

    @Inject
    EntityManager em;

    @Inject
    UserTransaction tx;

    @Test
    @Order(-1)
    void cleanupLeftoverData() throws Exception {
        tx.begin();
        try {
            em.createQuery("DELETE FROM alert_state s WHERE s.rule.name IN (:names)")
                    .setParameter("names", java.util.List.of("it-warning-rule", "it-critical-rule"))
                    .executeUpdate();
            em.createQuery("DELETE FROM alert_event e WHERE e.ruleName IN (:names)")
                    .setParameter("names", java.util.List.of("it-warning-rule", "it-critical-rule"))
                    .executeUpdate();
            em.createQuery("DELETE FROM alert_rule r WHERE r.name IN (:names)")
                    .setParameter("names", java.util.List.of("it-warning-rule", "it-critical-rule"))
                    .executeUpdate();
            tx.commit();
        }
        catch (Exception e) {
            tx.rollback();
            throw e;
        }
    }

    @Test
    @Order(0)
    void seedTestData() throws Exception {
        tx.begin();
        try {
            AlertRuleEntity warningRule = new AlertRuleEntity();
            warningRule.setName("it-warning-rule");
            warningRule.setPanelId("event-count");
            warningRule.setOperator(Operator.GREATER_THAN);
            warningRule.setThreshold(100.0);
            warningRule.setForDuration("PT0S");
            warningRule.setReduceFunction(ReduceFunction.LAST);
            warningRule.setEvaluationWindow("PT5M");
            warningRule.setSeverity(Severity.WARNING);
            warningRule.setEnabled(true);
            em.persist(warningRule);

            AlertRuleEntity criticalRule = new AlertRuleEntity();
            criticalRule.setName("it-critical-rule");
            criticalRule.setPanelId("event-count");
            criticalRule.setOperator(Operator.GREATER_THAN);
            criticalRule.setThreshold(500.0);
            criticalRule.setForDuration("PT0S");
            criticalRule.setReduceFunction(ReduceFunction.LAST);
            criticalRule.setEvaluationWindow("PT5M");
            criticalRule.setSeverity(Severity.CRITICAL);
            criticalRule.setEnabled(true);
            em.persist(criticalRule);

            AlertEventEntity firingEvent = new AlertEventEntity();
            firingEvent.setRule(warningRule);
            firingEvent.setRuleName("it-warning-rule");
            firingEvent.setPipelineId("pipeline-alpha");
            firingEvent.setPipelineName("Alpha Pipeline");
            firingEvent.setValue(150.0);
            firingEvent.setThreshold(100.0);
            firingEvent.setSeverity(Severity.WARNING);
            firingEvent.setMessage("Threshold exceeded");
            firingEvent.setFiredAt(Instant.parse("2026-07-30T09:00:00Z"));
            em.persist(firingEvent);

            AlertEventEntity resolvedEvent = new AlertEventEntity();
            resolvedEvent.setRule(warningRule);
            resolvedEvent.setRuleName("it-warning-rule");
            resolvedEvent.setPipelineId("pipeline-beta");
            resolvedEvent.setPipelineName("Beta Pipeline");
            resolvedEvent.setValue(120.0);
            resolvedEvent.setThreshold(100.0);
            resolvedEvent.setSeverity(Severity.WARNING);
            resolvedEvent.setMessage("Threshold exceeded then resolved");
            resolvedEvent.setFiredAt(Instant.parse("2026-07-30T08:00:00Z"));
            resolvedEvent.setResolvedAt(Instant.parse("2026-07-30T08:10:00Z"));
            em.persist(resolvedEvent);

            AlertEventEntity criticalEvent = new AlertEventEntity();
            criticalEvent.setRule(criticalRule);
            criticalEvent.setRuleName("it-critical-rule");
            criticalEvent.setPipelineId("pipeline-alpha");
            criticalEvent.setPipelineName("Alpha Pipeline");
            criticalEvent.setValue(600.0);
            criticalEvent.setThreshold(500.0);
            criticalEvent.setSeverity(Severity.CRITICAL);
            criticalEvent.setMessage("Critical threshold exceeded");
            criticalEvent.setFiredAt(Instant.parse("2026-07-30T09:30:00Z"));
            em.persist(criticalEvent);

            AlertStateEntity firingState = new AlertStateEntity();
            firingState.setRule(warningRule);
            firingState.setPipelineId("pipeline-alpha");
            firingState.setState(AlertStateValue.FIRING);
            firingState.setValue(150.0);
            firingState.setFiredAt(Instant.parse("2026-07-30T09:00:00Z"));
            firingState.setActiveEvent(firingEvent);
            em.persist(firingState);

            AlertStateEntity pendingState = new AlertStateEntity();
            pendingState.setRule(criticalRule);
            pendingState.setPipelineId("pipeline-alpha");
            pendingState.setState(AlertStateValue.PENDING);
            pendingState.setValue(450.0);
            pendingState.setPendingSince(Instant.parse("2026-07-30T09:25:00Z"));
            em.persist(pendingState);

            em.flush();

            ruleWarningId = warningRule.getId();
            ruleCriticalId = criticalRule.getId();
            firingEventId = firingEvent.getId();
            resolvedEventId = resolvedEvent.getId();
            criticalEventId = criticalEvent.getId();

            tx.commit();
        }
        catch (Exception e) {
            tx.rollback();
            throw e;
        }
    }

    @Test
    @Order(1)
    void listEventsDefaultPage() {
        given()
                .when().get(EVENTS_PATH)
                .then()
                .statusCode(200)
                .body("page", is(0))
                .body("size", is(20))
                .body("totalElements", is(3))
                .body("totalPages", is(1))
                .body("events", hasSize(3));
    }

    @Test
    @Order(2)
    void listEventsFilterSeverityWarning() {
        given()
                .queryParam("severity", "WARNING")
                .when().get(EVENTS_PATH)
                .then()
                .statusCode(200)
                .body("totalElements", is(2))
                .body("events", hasSize(2));
    }

    @Test
    @Order(3)
    void listEventsFilterSeverityCritical() {
        given()
                .queryParam("severity", "CRITICAL")
                .when().get(EVENTS_PATH)
                .then()
                .statusCode(200)
                .body("totalElements", is(1))
                .body("events", hasSize(1))
                .body("events[0].severity", is("CRITICAL"));
    }

    @Test
    @Order(4)
    void listEventsFilterStatusFiring() {
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
    void listEventsFilterStatusResolved() {
        given()
                .queryParam("status", "resolved")
                .when().get(EVENTS_PATH)
                .then()
                .statusCode(200)
                .body("totalElements", is(1))
                .body("events", hasSize(1))
                .body("events[0].status", is("resolved"))
                .body("events[0].resolvedAt", notNullValue());
    }

    @Test
    @Order(6)
    void listEventsFilterPipelineId() {
        given()
                .queryParam("pipelineId", "pipeline-beta")
                .when().get(EVENTS_PATH)
                .then()
                .statusCode(200)
                .body("totalElements", is(1))
                .body("events", hasSize(1))
                .body("events[0].pipelineId", is("pipeline-beta"));
    }

    @Test
    @Order(7)
    void listEventsFilterRuleId() {
        given()
                .queryParam("ruleId", ruleCriticalId)
                .when().get(EVENTS_PATH)
                .then()
                .statusCode(200)
                .body("totalElements", is(1))
                .body("events", hasSize(1))
                .body("events[0].ruleName", is("it-critical-rule"));
    }

    @Test
    @Order(8)
    void listEventsWithPagination() {
        given()
                .queryParam("page", 0)
                .queryParam("size", 2)
                .when().get(EVENTS_PATH)
                .then()
                .statusCode(200)
                .body("page", is(0))
                .body("size", is(2))
                .body("totalElements", is(3))
                .body("totalPages", is(2))
                .body("events", hasSize(2));
    }

    @Test
    @Order(9)
    void getEventById() {
        given()
                .when().get(EVENTS_PATH + "/" + firingEventId)
                .then()
                .statusCode(200)
                .body("id", equalTo(firingEventId.intValue()))
                .body("ruleName", is("it-warning-rule"))
                .body("pipelineId", is("pipeline-alpha"))
                .body("pipelineName", is("Alpha Pipeline"))
                .body("status", is("firing"))
                .body("value", is(150.0f))
                .body("threshold", is(100.0f))
                .body("severity", is("WARNING"))
                .body("message", is("Threshold exceeded"))
                .body("firedAt", notNullValue())
                .body("resolvedAt", nullValue())
                .body("durationSeconds", notNullValue())
                .body("createdAt", notNullValue());
    }

    @Test
    @Order(10)
    void getEventByIdResolved() {
        given()
                .when().get(EVENTS_PATH + "/" + resolvedEventId)
                .then()
                .statusCode(200)
                .body("status", is("resolved"))
                .body("resolvedAt", notNullValue())
                .body("durationSeconds", is(600));
    }

    @Test
    @Order(11)
    void getEventNotFound() {
        given()
                .when().get(EVENTS_PATH + "/999999")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(12)
    void getStatusSummary() {
        given()
                .when().get(STATUS_PATH)
                .then()
                .statusCode(200)
                .body("totalFiring", is(1))
                .body("totalPending", is(1))
                .body("firingBySeverity.WARNING", is(1))
                .body("activeAlerts", hasSize(2));
    }

    @Test
    @Order(13)
    void wrongPageSizeShouldReturnError() {
        given()
                .queryParam("page", 0)
                .queryParam("size", 0)
                .when().get(EVENTS_PATH)
                .then()
                .statusCode(400)
                .body("title", CoreMatchers.is("Constraint Violation"))
                .body("violations", containsInAnyOrder(
                        allOf(
                                hasEntry("field", "listEvents.page"),
                                hasEntry("message", "must be greater than or equal to 1")),
                        allOf(
                                hasEntry("field", "listEvents.size"),
                                hasEntry("message", "must be greater than or equal to 1"))));
    }

    @Test
    @Order(99)
    void cleanupTestData() throws Exception {
        tx.begin();
        try {
            em.createQuery("DELETE FROM alert_state s WHERE s.rule.id IN (:ids)")
                    .setParameter("ids", java.util.List.of(ruleWarningId, ruleCriticalId))
                    .executeUpdate();
            em.createQuery("DELETE FROM alert_event e WHERE e.rule.id IN (:ids)")
                    .setParameter("ids", java.util.List.of(ruleWarningId, ruleCriticalId))
                    .executeUpdate();
            em.createQuery("DELETE FROM alert_rule r WHERE r.id IN (:ids)")
                    .setParameter("ids", java.util.List.of(ruleWarningId, ruleCriticalId))
                    .executeUpdate();
            tx.commit();
        }
        catch (Exception e) {
            tx.rollback();
            throw e;
        }
    }
}
