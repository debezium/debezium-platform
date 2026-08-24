/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static jakarta.transaction.Transactional.TxType.SUPPORTS;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import org.jboss.logging.Logger;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.api.dto.AlertStatusResponse;
import io.debezium.platform.api.dto.AlertStatusResponse.ActiveAlertResponse;
import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.AlertStateEntity;
import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.Severity;
import io.debezium.platform.domain.alert.AlertNotificationReady;
import io.debezium.platform.domain.alert.AlertTransitionEvaluator;
import io.debezium.platform.domain.alert.StateTransition;
import io.debezium.platform.domain.views.AlertState;
import io.debezium.platform.domain.views.refs.AlertStateReference;

@ApplicationScoped
public class AlertStateService extends AbstractService<AlertStateEntity, AlertState, AlertStateReference> {

    private static final Logger LOGGER = Logger.getLogger(AlertStateService.class);

    private final Event<AlertNotificationReady> notificationEvent;
    private final AlertTransitionEvaluator transitionEvaluator;
    private final AlertEventService alertEventService;

    public AlertStateService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm,
                             Event<AlertNotificationReady> notificationEvent,
                             AlertTransitionEvaluator transitionEvaluator,
                             AlertEventService alertEventService) {
        super(AlertStateEntity.class, AlertState.class, AlertStateReference.class, em, cbf, evm);
        this.notificationEvent = notificationEvent;
        this.transitionEvaluator = transitionEvaluator;
        this.alertEventService = alertEventService;
    }

    public List<AlertStateEntity> findByRuleId(Long ruleId) {
        return em.createNamedQuery(AlertStateEntity.FIND_BY_RULE_ID, AlertStateEntity.class)
                .setParameter("ruleId", ruleId)
                .getResultList();
    }

    public List<AlertStateEntity> findActive() {
        return em.createNamedQuery(AlertStateEntity.FIND_ACTIVE, AlertStateEntity.class)
                .setParameter("states", List.of(AlertStateValue.FIRING, AlertStateValue.PENDING))
                .getResultList();
    }

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

    public void resolve(AlertRuleEntity rule, AlertStateEntity state, Instant now) {
        AlertEventEntity event = state.getActiveEvent();
        if (event != null) {
            alertEventService.resolveEvent(event, now);
            notificationEvent.fire(AlertNotificationReady.from(rule, event));
        }

        state.setState(AlertStateValue.OK);
        state.setFiredAt(null);
        state.setPendingSince(null);
        state.setActiveEvent(null);
        em.merge(state);
    }

    @Transactional(SUPPORTS)
    public AlertStatusResponse getStatus() {
        List<AlertStateEntity> activeStates = findActive();

        int totalFiring = 0;
        int totalPending = 0;
        Map<Severity, Integer> firingBySeverity = new EnumMap<>(Severity.class);
        List<ActiveAlertResponse> activeAlerts = new ArrayList<>();

        for (AlertStateEntity state : activeStates) {
            if (state.getState() == AlertStateValue.FIRING) {
                totalFiring++;
                Severity sev = state.getRule().getSeverity();
                firingBySeverity.merge(sev, 1, Integer::sum);
            }
            else {
                totalPending++;
            }

            Instant since = state.getState() == AlertStateValue.FIRING
                    ? state.getFiredAt()
                    : state.getPendingSince();

            activeAlerts.add(new ActiveAlertResponse(
                    state.getRule().getId(),
                    state.getRule().getName(),
                    state.getPipelineId(),
                    state.getState(),
                    state.getRule().getSeverity(),
                    state.getValue() != null ? state.getValue() : 0.0,
                    state.getRule().getThreshold(),
                    since));
        }

        return new AlertStatusResponse(totalFiring, totalPending, firingBySeverity, activeAlerts);
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
        AlertEventEntity event = alertEventService.createFiringEvent(
                rule, state.getPipelineId(), state.getValue(), formatMessage(rule, state), now);

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
