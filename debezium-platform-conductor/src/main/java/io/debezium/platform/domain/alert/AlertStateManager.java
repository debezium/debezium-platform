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
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.AlertStateEntity;
import io.debezium.platform.data.model.AlertStateValue;

@ApplicationScoped
public class AlertStateManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(AlertStateManager.class);

    private final EntityManager em;
    private final NotificationDispatcher dispatcher;

    public AlertStateManager(EntityManager em, NotificationDispatcher dispatcher) {
        this.em = em;
        this.dispatcher = dispatcher;
    }

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

        switch (state.getState()) {
            case OK -> {
                if (conditionMet) {
                    if (forDuration.isZero()) {
                        state.setState(AlertStateValue.FIRING);
                        state.setFiredAt(now);
                        em.persist(state);
                        fireAlert(rule, state, now);
                    }
                    else {
                        state.setState(AlertStateValue.PENDING);
                        state.setPendingSince(now);
                        em.persist(state);
                    }
                }
                else {
                    em.persist(state);
                }
            }
            case PENDING -> {
                if (!conditionMet) {
                    state.setState(AlertStateValue.OK);
                    state.setPendingSince(null);
                    em.persist(state);
                }
                else if (Duration.between(state.getPendingSince(), now).compareTo(forDuration) >= 0) {
                    state.setState(AlertStateValue.FIRING);
                    state.setFiredAt(now);
                    em.persist(state);
                    fireAlert(rule, state, now);
                }
                else {
                    em.persist(state);
                }
            }
            case FIRING -> {
                if (!conditionMet) {
                    resolve(rule, state, now);
                }
                else {
                    em.merge(state);
                }
            }
            default -> LOGGER.warn("Unexpected state '{}' for rule '{}', pipeline '{}'",
                    state.getState(), rule.getName(), pipelineId);
        }
    }

    @Transactional
    public void resolve(AlertRuleEntity rule, AlertStateEntity state, Instant now) {
        AlertEventEntity event = state.getActiveEvent();
        if (event != null) {
            event.setResolvedAt(now);
            em.merge(event);
            dispatcher.dispatch(rule, event);
        }

        state.setState(AlertStateValue.OK);
        state.setFiredAt(null);
        state.setPendingSince(null);
        state.setActiveEvent(null);
        em.merge(state);
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

        dispatcher.dispatch(rule, event);
    }

    private String formatMessage(AlertRuleEntity rule, AlertStateEntity state) {
        return String.format("Alert '%s': value %.4f %s threshold %.4f for pipeline '%s'",
                rule.getName(), state.getValue(), rule.getOperator().name(), rule.getThreshold(),
                state.getPipelineId());
    }
}
