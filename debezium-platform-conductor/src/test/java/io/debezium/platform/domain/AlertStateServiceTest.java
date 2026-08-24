/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import jakarta.enterprise.event.Event;
import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.AlertStateEntity;
import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.ReduceFunction;
import io.debezium.platform.data.model.Severity;
import io.debezium.platform.domain.alert.AlertNotificationReady;
import io.debezium.platform.domain.alert.AlertTransitionEvaluator;
import io.debezium.platform.domain.alert.StateTransition;

@ExtendWith(MockitoExtension.class)
class AlertStateServiceTest {

    @Mock
    EntityManager em;

    @Mock
    CriteriaBuilderFactory cbf;

    @Mock
    EntityViewManager evm;

    @Mock
    Event<AlertNotificationReady> notificationEvent;

    @Mock
    AlertTransitionEvaluator transitionEvaluator;

    @Mock
    AlertEventService alertEventService;

    AlertStateService stateService;

    AlertRuleEntity rule;
    Instant now;

    @BeforeEach
    void setUp() {
        stateService = new AlertStateService(em, cbf, evm, notificationEvent, transitionEvaluator, alertEventService);
        rule = createRule("test-rule", Operator.GREATER_THAN, 100.0, "PT0S");
        now = Instant.parse("2026-07-30T10:00:00Z");
    }

    @Test
    void evaluateNoneActionPersistsNewState() {
        when(transitionEvaluator.evaluate(any(), eq(true), any(), any(), any()))
                .thenReturn(new StateTransition(AlertStateValue.OK, StateTransition.Action.NONE, null, null));

        stateService.evaluate(rule, "pipeline-1", 150.0, null, now);

        ArgumentCaptor<AlertStateEntity> captor = ArgumentCaptor.forClass(AlertStateEntity.class);
        verify(em).persist(captor.capture());
        assertThat(captor.getValue().getState()).isEqualTo(AlertStateValue.OK);
        assertThat(captor.getValue().getValue()).isEqualTo(150.0);
        assertThat(captor.getValue().getLastEvaluatedAt()).isEqualTo(now);
        verify(notificationEvent, never()).fire(any());
    }

    @Test
    void evaluateNoneActionMergesExistingState() {
        AlertStateEntity state = createState(AlertStateValue.OK, "pipeline-1");
        state.setId(1L);

        when(transitionEvaluator.evaluate(any(), eq(false), any(), any(), any()))
                .thenReturn(new StateTransition(AlertStateValue.OK, StateTransition.Action.NONE, null, null));

        stateService.evaluate(rule, "pipeline-1", 50.0, state, now);

        verify(em).merge(state);
        verify(em, never()).persist(any());
    }

    @Test
    void evaluateFireActionCreatesEventAndDispatches() {
        AlertEventEntity createdEvent = new AlertEventEntity();
        createdEvent.setId(1L);
        createdEvent.setRule(rule);
        createdEvent.setRuleName(rule.getName());
        createdEvent.setPipelineId("pipeline-1");
        createdEvent.setValue(150.0);
        createdEvent.setThreshold(rule.getThreshold());
        createdEvent.setSeverity(rule.getSeverity());
        createdEvent.setFiredAt(now);
        when(alertEventService.createFiringEvent(eq(rule), eq("pipeline-1"), eq(150.0), any(), eq(now)))
                .thenReturn(createdEvent);
        when(transitionEvaluator.evaluate(any(), eq(true), any(), any(), any()))
                .thenReturn(new StateTransition(AlertStateValue.FIRING, StateTransition.Action.FIRE, null, now));

        stateService.evaluate(rule, "pipeline-1", 150.0, null, now);

        verify(alertEventService).createFiringEvent(eq(rule), eq("pipeline-1"), eq(150.0), any(), eq(now));
        verify(notificationEvent).fire(any(AlertNotificationReady.class));
    }

    @Test
    void evaluateResolveActionResolvesActiveEvent() {
        AlertStateEntity state = createState(AlertStateValue.FIRING, "pipeline-1");
        state.setId(1L);
        AlertEventEntity activeEvent = new AlertEventEntity();
        activeEvent.setId(1L);
        activeEvent.setValue(150.0);
        activeEvent.setThreshold(100.0);
        state.setActiveEvent(activeEvent);

        when(transitionEvaluator.evaluate(any(), eq(false), any(), any(), any()))
                .thenReturn(new StateTransition(AlertStateValue.OK, StateTransition.Action.RESOLVE, null, null));

        stateService.evaluate(rule, "pipeline-1", 50.0, state, now);

        verify(alertEventService).resolveEvent(activeEvent, now);
        assertThat(state.getState()).isEqualTo(AlertStateValue.OK);
        assertThat(state.getFiredAt()).isNull();
        assertThat(state.getActiveEvent()).isNull();
        verify(notificationEvent).fire(any(AlertNotificationReady.class));
    }

    @Test
    void resolveSetsResolvedAtOnEvent() {
        AlertStateEntity state = createState(AlertStateValue.FIRING, "pipeline-1");
        AlertEventEntity event = new AlertEventEntity();
        event.setId(1L);
        event.setValue(150.0);
        event.setThreshold(100.0);
        state.setActiveEvent(event);

        stateService.resolve(rule, state, now);

        verify(alertEventService).resolveEvent(event, now);
        assertThat(state.getState()).isEqualTo(AlertStateValue.OK);
        assertThat(state.getFiredAt()).isNull();
        assertThat(state.getPendingSince()).isNull();
        assertThat(state.getActiveEvent()).isNull();
        verify(notificationEvent).fire(any(AlertNotificationReady.class));
    }

    @Test
    void resolveNoActiveEventSkipsDispatch() {
        AlertStateEntity state = createState(AlertStateValue.FIRING, "pipeline-1");

        stateService.resolve(rule, state, now);

        assertThat(state.getState()).isEqualTo(AlertStateValue.OK);
        verify(notificationEvent, never()).fire(any());
    }

    @Test
    void evaluateSetsValueAndTimestampBeforeTransition() {
        when(transitionEvaluator.evaluate(eq(AlertStateValue.OK), eq(true), any(), any(), eq(now)))
                .thenReturn(new StateTransition(AlertStateValue.PENDING, StateTransition.Action.NONE, now, null));

        stateService.evaluate(rule, "pipeline-1", 150.0, null, now);

        ArgumentCaptor<AlertStateEntity> captor = ArgumentCaptor.forClass(AlertStateEntity.class);
        verify(em).persist(captor.capture());
        assertThat(captor.getValue().getValue()).isEqualTo(150.0);
        assertThat(captor.getValue().getLastEvaluatedAt()).isEqualTo(now);
        assertThat(captor.getValue().getPendingSince()).isEqualTo(now);
    }

    private AlertRuleEntity createRule(String name, Operator operator, double threshold, String forDuration) {
        AlertRuleEntity rule = new AlertRuleEntity();
        rule.setId(1L);
        rule.setName(name);
        rule.setPanelId("event-count");
        rule.setOperator(operator);
        rule.setThreshold(threshold);
        rule.setForDuration(forDuration);
        rule.setReduceFunction(ReduceFunction.LAST);
        rule.setEvaluationWindow("5m");
        rule.setSeverity(Severity.WARNING);
        rule.setEnabled(true);
        return rule;
    }

    private AlertStateEntity createState(AlertStateValue stateValue, String pipelineId) {
        AlertStateEntity state = new AlertStateEntity();
        state.setRule(rule);
        state.setPipelineId(pipelineId);
        state.setState(stateValue);
        return state;
    }
}
