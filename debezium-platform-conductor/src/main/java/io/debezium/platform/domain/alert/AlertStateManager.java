/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import org.jboss.logging.Logger;

import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.AlertStateEntity;
import io.debezium.platform.data.model.AlertStateValue;

@ApplicationScoped
public class AlertStateManager {

    private static final Logger LOGGER = Logger.getLogger(AlertStateManager.class);

    private final EntityManager em;
    private final Event<AlertNotificationReady> notificationEvent;
    private final AlertTransitionEvaluator transitionEvaluator;

    public AlertStateManager(EntityManager em, Event<AlertNotificationReady> notificationEvent,
                             AlertTransitionEvaluator transitionEvaluator) {
        this.em = em;
        this.notificationEvent = notificationEvent;
        this.transitionEvaluator = transitionEvaluator;
    }

    @Transactional
    public List<AlertStateEntity> findByRuleId(Long ruleId) {
        return em.createNamedQuery(AlertStateEntity.FIND_BY_RULE_ID, AlertStateEntity.class)
                .setParameter("ruleId", ruleId)
                .getResultList();
    }

    @Transactional
    public void evaluate(AlertRuleEntity rule, String pipelineId, double value,
                         AlertStateEntity state, Instant now) {
        boolean conditionMet = rule.getOperator().evaluate(value, rule.getThreshold());
        Duration forDuration = Duration.parse(rule.getForDuration());

        if (state == null) {
            state = new AlertStateEntity();
            state.setRule(rule);
            state.setPipelineId(pipelineId);
            state.setState(AlertStateValue.OK);
        }

        state.setValue(value);
        state.setLastEvaluatedAt(now);

        StateTransition transition = transitionEvaluator.evaluate(
                state.getState(), conditionMet, forDuration, state.getPendingSince(), now);

        applyTransition(rule, state, transition, now);
    }

    @Transactional
    public void resolve(AlertRuleEntity rule, AlertStateEntity state, Instant now) {
        AlertEventEntity event = state.getActiveEvent();
        if (event != null) {
            event.setResolvedAt(now);
            em.merge(event);
            notificationEvent.fire(AlertNotificationReady.from(rule, event));
        }

        state.setState(AlertStateValue.OK);
        state.setFiredAt(null);
        state.setPendingSince(null);
        state.setActiveEvent(null);
        em.merge(state);
    }

    private void applyTransition(AlertRuleEntity rule, AlertStateEntity state,
                                 StateTransition transition, Instant now) {
        state.setState(transition.newState());
        state.setPendingSince(transition.pendingSince());
        state.setFiredAt(transition.firedAt());

        switch (transition.action()) {
            case FIRE -> {
                if (state.getId() == null) {
                    em.persist(state);
                }
                fireAlert(rule, state, now);
            }
            case RESOLVE -> resolve(rule, state, now);
            case NONE -> {
                if (state.getId() == null) {
                    em.persist(state);
                }
                else {
                    em.merge(state);
                }
            }
        }
    }

    private void fireAlert(AlertRuleEntity rule, AlertStateEntity state, Instant now) {
        AlertEventEntity event = new AlertEventEntity();
        event.setRule(rule);
        event.setRuleName(rule.getName());
        event.setPipelineId(state.getPipelineId());
        event.setValue(state.getValue());
        event.setThreshold(rule.getThreshold());
        event.setSeverity(rule.getSeverity());
        event.setFiredAt(now);
        event.setMessage(formatMessage(rule, state));
        em.persist(event);

        state.setActiveEvent(event);
        em.merge(state);

        notificationEvent.fire(AlertNotificationReady.from(rule, event));
    }

    private String formatMessage(AlertRuleEntity rule, AlertStateEntity state) {
        return String.format("Alert '%s': value %.4f %s threshold %.4f for pipeline '%s'",
                rule.getName(), state.getValue(), rule.getOperator().name(), rule.getThreshold(),
                state.getPipelineId());
    }
}
