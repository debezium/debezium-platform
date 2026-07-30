/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.Severity;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@TestProfile(AlertHistoryCleanupTestProfile.class)
class AlertHistoryCleanupIT {

    @Inject
    EntityManager em;

    @Inject
    UserTransaction tx;

    @Inject
    AlertHistoryCleanup cleanup;

    @AfterEach
    void cleanupTestData() throws Exception {
        tx.begin();
        em.createQuery("DELETE FROM alert_event").executeUpdate();
        em.createQuery("DELETE FROM alert_rule").executeUpdate();
        tx.commit();
    }

    @Test
    void cleanupDeletesOldResolvedEvents() throws Exception {
        tx.begin();
        AlertRuleEntity rule = createAndPersistRule("cleanup-test-rule-1");
        AlertEventEntity event = createEvent(rule, "pipeline-1", Severity.WARNING,
                Instant.now().minusSeconds(60), Instant.now().minusSeconds(30));
        em.persist(event);
        Long eventId = event.getId();
        tx.commit();

        cleanup.cleanup();

        tx.begin();
        AlertEventEntity found = em.find(AlertEventEntity.class, eventId);
        assertThat(found).isNull();
        tx.commit();
    }

    @Test
    void cleanupPreservesUnresolvedEvents() throws Exception {
        tx.begin();
        AlertRuleEntity rule = createAndPersistRule("cleanup-test-rule-2");
        AlertEventEntity event = createEvent(rule, "pipeline-1", Severity.CRITICAL,
                Instant.now().minusSeconds(60), null);
        em.persist(event);
        Long eventId = event.getId();
        tx.commit();

        cleanup.cleanup();

        tx.begin();
        AlertEventEntity found = em.find(AlertEventEntity.class, eventId);
        assertThat(found).isNotNull();
        tx.commit();
    }

    @Test
    void cleanupPreservesRecentResolvedEvents() throws Exception {
        tx.begin();
        AlertRuleEntity rule = createAndPersistRule("cleanup-test-rule-3");
        AlertEventEntity event = createEvent(rule, "pipeline-1", Severity.INFO,
                Instant.now(), Instant.now());
        em.persist(event);
        Long eventId = event.getId();
        tx.commit();

        cleanup.cleanup();

        tx.begin();
        AlertEventEntity found = em.find(AlertEventEntity.class, eventId);
        assertThat(found).isNotNull();
        tx.commit();
    }

    private AlertRuleEntity createAndPersistRule(String name) {
        AlertRuleEntity rule = new AlertRuleEntity();
        rule.setName(name);
        rule.setPanelId("event-count");
        rule.setOperator(Operator.GREATER_THAN);
        rule.setThreshold(100.0);
        rule.setSeverity(Severity.WARNING);
        rule.setEnabled(true);
        em.persist(rule);
        return rule;
    }

    private AlertEventEntity createEvent(AlertRuleEntity rule, String pipelineId,
                                         Severity severity, Instant firedAt, Instant resolvedAt) {
        AlertEventEntity event = new AlertEventEntity();
        event.setRule(rule);
        event.setRuleName(rule.getName());
        event.setPipelineId(pipelineId);
        event.setValue(150.0);
        event.setThreshold(100.0);
        event.setSeverity(severity);
        event.setFiredAt(firedAt);
        event.setResolvedAt(resolvedAt);
        event.setMessage("Test alert event");
        return event;
    }
}
