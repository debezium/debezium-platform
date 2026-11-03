/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;

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
import io.restassured.http.ContentType;

@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AlertRuleResourceIT {

    private static final String RULES_PATH = "api/alerts/rules";
    private static final String CHANNELS_PATH = "api/alerts/channels";
    private static final String EVENTS_PATH = "api/alerts/events";

    static Long ruleId;
    static Long ruleWithChannelsId;
    static Long channelId;

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
                    .setParameter("names", List.of("it-test-rule", "it-test-rule-updated", "it-rule-with-channels", "it-firing-rule"))
                    .executeUpdate();
            em.createQuery("DELETE FROM alert_event e WHERE e.ruleName IN (:names)")
                    .setParameter("names", List.of("it-test-rule", "it-test-rule-updated", "it-rule-with-channels", "it-firing-rule"))
                    .executeUpdate();
            em.createNativeQuery("DELETE FROM alert_rule_channel WHERE rule_id IN (SELECT id FROM alert_rule WHERE name IN (:names))")
                    .setParameter("names", List.of("it-test-rule", "it-test-rule-updated", "it-rule-with-channels", "it-firing-rule"))
                    .executeUpdate();
            em.createQuery("DELETE FROM alert_rule r WHERE r.name IN (:names)")
                    .setParameter("names", List.of("it-test-rule", "it-test-rule-updated", "it-rule-with-channels", "it-firing-rule"))
                    .executeUpdate();
            em.createQuery("DELETE FROM notification_channel c WHERE c.name = :name")
                    .setParameter("name", "rule-test-webhook")
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
    void createChannelForRuleTests() {
        channelId = given()
                .contentType(ContentType.JSON)
                .body(Map.of(
                        "name", "rule-test-webhook",
                        "type", "WEBHOOK",
                        "enabled", true,
                        "config", Map.of("url", "http://localhost:9999/hook")))
                .when().post(CHANNELS_PATH)
                .then()
                .statusCode(201)
                .extract().jsonPath().getLong("id");
    }

    @Test
    @Order(1)
    void listRulesEmpty() {
        given()
                .when().get(RULES_PATH)
                .then()
                .statusCode(200)
                .body("$", empty());
    }

    @Test
    @Order(2)
    void createRuleValid() {
        ruleId = given()
                .contentType(ContentType.JSON)
                .body(Map.ofEntries(
                        Map.entry("name", "it-test-rule"),
                        Map.entry("panelId", "streaming-event-count"),
                        Map.entry("operator", "GREATER_THAN"),
                        Map.entry("threshold", 100.0),
                        Map.entry("severity", "WARNING"),
                        Map.entry("forDuration", "PT0S"),
                        Map.entry("reduceFunction", "LAST"),
                        Map.entry("evaluationWindow", "PT5M"),
                        Map.entry("enabled", true)))
                .when().post(RULES_PATH)
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("name", is("it-test-rule"))
                .body("panelId", is("streaming-event-count"))
                .body("panelTitle", is("Streaming Event Count Rate"))
                .body("operator", is("GREATER_THAN"))
                .body("threshold", is(100.0f))
                .body("severity", is("WARNING"))
                .body("enabled", is(true))
                .body("channels", empty())
                .extract().jsonPath().getLong("id");
    }

    @Test
    @Order(3)
    void createRuleWithChannels() {
        ruleWithChannelsId = given()
                .contentType(ContentType.JSON)
                .body(Map.ofEntries(
                        Map.entry("name", "it-rule-with-channels"),
                        Map.entry("panelId", "streaming-event-count"),
                        Map.entry("operator", "LESS_THAN"),
                        Map.entry("threshold", 10.0),
                        Map.entry("severity", "CRITICAL"),
                        Map.entry("forDuration", "PT0S"),
                        Map.entry("reduceFunction", "LAST"),
                        Map.entry("evaluationWindow", "PT5M"),
                        Map.entry("enabled", true),
                        Map.entry("channelIds", List.of(channelId))))
                .when().post(RULES_PATH)
                .then()
                .statusCode(201)
                .body("channels", hasSize(1))
                .extract().jsonPath().getLong("id");
    }

    @Test
    @Order(4)
    void getRuleById() {
        given()
                .when().get(RULES_PATH + "/" + ruleId)
                .then()
                .statusCode(200)
                .body("id", equalTo(ruleId.intValue()))
                .body("name", is("it-test-rule"))
                .body("panelId", is("streaming-event-count"))
                .body("operator", is("GREATER_THAN"));
    }

    @Test
    @Order(5)
    void getRuleNotFound() {
        given()
                .when().get(RULES_PATH + "/999999")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(6)
    void updateRule() {
        given()
                .contentType(ContentType.JSON)
                .body(Map.ofEntries(
                        Map.entry("name", "it-test-rule-updated"),
                        Map.entry("panelId", "streaming-event-count"),
                        Map.entry("operator", "GREATER_THAN"),
                        Map.entry("threshold", 200.0),
                        Map.entry("severity", "CRITICAL"),
                        Map.entry("forDuration", "PT0S"),
                        Map.entry("reduceFunction", "LAST"),
                        Map.entry("evaluationWindow", "PT5M"),
                        Map.entry("enabled", true)))
                .when().put(RULES_PATH + "/" + ruleId)
                .then()
                .statusCode(200)
                .body("name", is("it-test-rule-updated"))
                .body("threshold", is(200.0f))
                .body("severity", is("CRITICAL"));
    }

    @Test
    @Order(7)
    void disableRule() {
        given()
                .when().put(RULES_PATH + "/" + ruleId + "/disable")
                .then()
                .statusCode(200)
                .body("enabled", is(false));
    }

    @Test
    @Order(8)
    void enableRule() {
        given()
                .when().put(RULES_PATH + "/" + ruleId + "/enable")
                .then()
                .statusCode(200)
                .body("enabled", is(true));
    }

    @Test
    @Order(9)
    void createRuleDuplicateName() {
        given()
                .contentType(ContentType.JSON)
                .body(Map.ofEntries(
                        Map.entry("name", "it-test-rule-updated"),
                        Map.entry("panelId", "streaming-event-count"),
                        Map.entry("operator", "GREATER_THAN"),
                        Map.entry("threshold", 100.0),
                        Map.entry("forDuration", "PT0S"),
                        Map.entry("reduceFunction", "LAST"),
                        Map.entry("evaluationWindow", "PT5M"),
                        Map.entry("enabled", true)))
                .when().post(RULES_PATH)
                .then()
                .statusCode(409);
    }

    @Test
    @Order(10)
    void createRuleBlankName() {
        given()
                .contentType(ContentType.JSON)
                .body(Map.ofEntries(
                        Map.entry("name", ""),
                        Map.entry("panelId", "streaming-event-count"),
                        Map.entry("operator", "GREATER_THAN"),
                        Map.entry("threshold", 100.0),
                        Map.entry("forDuration", "PT0S"),
                        Map.entry("reduceFunction", "LAST"),
                        Map.entry("evaluationWindow", "PT5M")))
                .when().post(RULES_PATH)
                .then()
                .statusCode(400);
    }

    @Test
    @Order(11)
    void createRuleInvalidPanelId() {
        given()
                .contentType(ContentType.JSON)
                .body(Map.ofEntries(
                        Map.entry("name", "rule-bad-panel"),
                        Map.entry("panelId", "non-existent-panel"),
                        Map.entry("operator", "GREATER_THAN"),
                        Map.entry("threshold", 100.0),
                        Map.entry("forDuration", "PT0S"),
                        Map.entry("reduceFunction", "LAST"),
                        Map.entry("evaluationWindow", "PT5M")))
                .when().post(RULES_PATH)
                .then()
                .statusCode(400);
    }

    @Test
    @Order(12)
    void createRuleEvaluationWindowTooSmall() {
        given()
                .contentType(ContentType.JSON)
                .body(Map.ofEntries(
                        Map.entry("name", "rule-window-too-small"),
                        Map.entry("panelId", "streaming-event-count"),
                        Map.entry("operator", "GREATER_THAN"),
                        Map.entry("threshold", 100.0),
                        Map.entry("forDuration", "PT0S"),
                        Map.entry("reduceFunction", "AVG"),
                        Map.entry("evaluationWindow", "PT30S")))
                .when().post(RULES_PATH)
                .then()
                .statusCode(400);
    }

    @Test
    @Order(13)
    void createRuleEvaluationWindowTooLarge() {
        given()
                .contentType(ContentType.JSON)
                .body(Map.ofEntries(
                        Map.entry("name", "rule-window-too-large"),
                        Map.entry("panelId", "streaming-event-count"),
                        Map.entry("operator", "GREATER_THAN"),
                        Map.entry("threshold", 100.0),
                        Map.entry("forDuration", "PT0S"),
                        Map.entry("reduceFunction", "AVG"),
                        Map.entry("evaluationWindow", "PT2H")))
                .when().post(RULES_PATH)
                .then()
                .statusCode(400);
    }

    @Test
    @Order(14)
    void deleteRuleResolvesItsFiringAlert() throws Exception {
        Long firingRuleId;
        Long firingEventId;
        Instant firedAt = Instant.now().minus(Duration.ofMinutes(10));

        tx.begin();
        try {
            AlertRuleEntity rule = new AlertRuleEntity();
            rule.setName("it-firing-rule");
            rule.setPanelId("streaming-event-count");
            rule.setOperator(Operator.GREATER_THAN);
            rule.setThreshold(100.0);
            rule.setForDuration("PT0S");
            rule.setReduceFunction(ReduceFunction.LAST);
            rule.setEvaluationWindow("PT5M");
            rule.setSeverity(Severity.WARNING);
            rule.setEnabled(true);
            em.persist(rule);

            AlertEventEntity event = new AlertEventEntity();
            event.setRule(rule);
            event.setRuleName("it-firing-rule");
            event.setPipelineId("it-firing-pipeline");
            event.setPipelineName("it-firing-pipeline");
            event.setValue(150.0);
            event.setThreshold(100.0);
            event.setSeverity(Severity.WARNING);
            event.setMessage("Threshold exceeded");
            event.setFiredAt(firedAt);
            em.persist(event);

            AlertStateEntity state = new AlertStateEntity();
            state.setRule(rule);
            state.setPipelineId("it-firing-pipeline");
            state.setState(AlertStateValue.FIRING);
            state.setValue(150.0);
            state.setFiredAt(firedAt);
            state.setActiveEvent(event);
            em.persist(state);

            em.flush();
            firingRuleId = rule.getId();
            firingEventId = event.getId();
            tx.commit();
        }
        catch (Exception e) {
            tx.rollback();
            throw e;
        }

        try {
            given()
                    .when().delete(RULES_PATH + "/" + firingRuleId)
                    .then()
                    .statusCode(204);

            given()
                    .when().get(EVENTS_PATH + "/" + firingEventId)
                    .then()
                    .statusCode(200)
                    .body("status", is("resolved"))
                    .body("resolvedAt", notNullValue());
        }
        finally {
            tx.begin();
            try {
                em.createQuery("DELETE FROM alert_event e WHERE e.id = :id")
                        .setParameter("id", firingEventId)
                        .executeUpdate();
                tx.commit();
            }
            catch (Exception e) {
                tx.rollback();
                throw e;
            }
        }
    }

    @Test
    @Order(96)
    void deleteRuleWithChannels() {
        given()
                .when().delete(RULES_PATH + "/" + ruleWithChannelsId)
                .then()
                .statusCode(204);
    }

    @Test
    @Order(97)
    void deleteRule() {
        given()
                .when().delete(RULES_PATH + "/" + ruleId)
                .then()
                .statusCode(204);
    }

    @Test
    @Order(98)
    void listRulesAfterDelete() {
        given()
                .when().get(RULES_PATH)
                .then()
                .statusCode(200)
                .body("$", empty());
    }

    @Test
    @Order(99)
    void deleteChannel() {
        given()
                .when().delete(CHANNELS_PATH + "/" + channelId)
                .then()
                .statusCode(204);
    }
}
