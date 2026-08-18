/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator;

import static io.debezium.platform.environment.operator.OperatorPipelineController.LABEL_DBZ_CONDUCTOR_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.List;
import java.util.Map;

import jakarta.enterprise.event.Event;
import jakarta.enterprise.inject.Instance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.debezium.operator.api.model.DebeziumServer;
import io.debezium.operator.api.model.status.Condition;
import io.debezium.operator.api.model.status.DebeziumServerStatus;
import io.debezium.platform.data.model.PipelineStatus;
import io.debezium.platform.environment.DebeziumServerStatusChanged;
import io.fabric8.kubernetes.api.model.ObjectMeta;
import io.fabric8.kubernetes.client.KubernetesClient;

@ExtendWith(MockitoExtension.class)
class OperatorPipelineStatusWatcherTest {

    @Mock
    Instance<KubernetesClient> kubernetesClient;

    @Mock
    Event<DebeziumServerStatusChanged> statusChangedEvent;

    @Captor
    ArgumentCaptor<DebeziumServerStatusChanged> eventCaptor;

    OperatorPipelineStatusWatcher watcher;

    @BeforeEach
    void setUp() {
        watcher = new OperatorPipelineStatusWatcher(kubernetesClient, statusChangedEvent);
    }

    @Test
    @DisplayName("Should fire STOPPED when Ready=True and Running=False")
    void reconcileFiresStoppedEvent() {
        var ds = debeziumServer(42L, List.of(
                new Condition("Ready", Condition.TRUE, null),
                new Condition("Running", Condition.FALSE, "Server is stopped")));

        watcher.reconcile(ds);

        verify(statusChangedEvent).fire(eventCaptor.capture());
        assertThat(eventCaptor.getValue().pipelineId()).isEqualTo(42L);
        assertThat(eventCaptor.getValue().status()).isEqualTo(PipelineStatus.STOPPED);
    }

    @Test
    @DisplayName("Should fire RUNNING when Ready condition is True")
    void reconcileFiresRunningEvent() {
        var ds = debeziumServer(42L, List.of(
                new Condition("Ready", Condition.TRUE, null),
                new Condition("Running", Condition.TRUE, null)));

        watcher.reconcile(ds);

        verify(statusChangedEvent).fire(eventCaptor.capture());
        assertThat(eventCaptor.getValue().status()).isEqualTo(PipelineStatus.RUNNING);
        assertThat(eventCaptor.getValue().message()).isNull();
    }

    @Test
    @DisplayName("Should fire FAILED with error message when Running is False and not stopped")
    void reconcileFiresFailedEventWithErrorMessage() {
        var ds = debeziumServer(42L, List.of(
                new Condition("Running", Condition.FALSE, "Engine crashed"),
                new Condition("Ready", Condition.FALSE, "Not ready")));

        watcher.reconcile(ds);

        verify(statusChangedEvent).fire(eventCaptor.capture());
        assertThat(eventCaptor.getValue().status()).isEqualTo(PipelineStatus.FAILED);
        assertThat(eventCaptor.getValue().message()).isEqualTo("Engine crashed");
    }

    @Test
    @DisplayName("Ready=True + Running=False maps to STOPPED, not FAILED")
    void reconcileStoppedNotFailed() {
        var ds = debeziumServer(42L, List.of(
                new Condition("Ready", Condition.TRUE, null),
                new Condition("Running", Condition.FALSE, "Server is stopped")));

        watcher.reconcile(ds);

        verify(statusChangedEvent).fire(eventCaptor.capture());
        assertThat(eventCaptor.getValue().status()).isEqualTo(PipelineStatus.STOPPED);
    }

    @Test
    @DisplayName("Should not fire event when Running=True but not yet Ready")
    void reconcileNoEventWhenRunningButNotReady() {
        var ds = debeziumServer(42L, List.of(
                new Condition("Running", Condition.TRUE, null),
                new Condition("Ready", Condition.FALSE, null)));

        watcher.reconcile(ds);

        verify(statusChangedEvent, never()).fire(any());
    }

    @Test
    @DisplayName("Should not fire event when status is null")
    void reconcileNoEventWhenStatusNull() {
        var ds = debeziumServer(42L, null);

        watcher.reconcile(ds);

        verify(statusChangedEvent, never()).fire(any());
    }

    @Test
    @DisplayName("Should not fire event when conditions list is empty")
    void reconcileNoEventWhenConditionsEmpty() {
        var ds = debeziumServer(42L, List.of());

        watcher.reconcile(ds);

        verify(statusChangedEvent, never()).fire(any());
    }

    @Test
    @DisplayName("Should not fire event when pipeline id label is missing")
    void reconcileNoEventWithoutLabel() {
        var ds = new DebeziumServer();
        ds.setMetadata(new ObjectMeta());
        ds.getMetadata().setLabels(Map.of());
        var status = new DebeziumServerStatus();
        status.setConditions(List.of(new Condition("Ready", Condition.TRUE, null)));
        ds.setStatus(status);

        watcher.reconcile(ds);

        verify(statusChangedEvent, never()).fire(any());
    }

    @Test
    @DisplayName("Should not fire event when labels map is null")
    void reconcileNoEventWhenLabelsNull() {
        var ds = new DebeziumServer();
        ds.setMetadata(new ObjectMeta());
        var status = new DebeziumServerStatus();
        status.setConditions(List.of(new Condition("Ready", Condition.TRUE, null)));
        ds.setStatus(status);

        watcher.reconcile(ds);

        verify(statusChangedEvent, never()).fire(any());
    }

    @Test
    @DisplayName("Should not fire event when conductor-id label is not a number")
    void reconcileNoEventWhenLabelNotNumeric() {
        var ds = new DebeziumServer();
        ds.setMetadata(new ObjectMeta());
        ds.getMetadata().setLabels(Map.of(LABEL_DBZ_CONDUCTOR_ID, "not-a-number"));
        var status = new DebeziumServerStatus();
        status.setConditions(List.of(new Condition("Ready", Condition.TRUE, null)));
        ds.setStatus(status);

        watcher.reconcile(ds);

        verify(statusChangedEvent, never()).fire(any());
    }

    @Test
    @DisplayName("Should fire event on update when status changes")
    void reconcileOnUpdateFiresEventOnStatusChange() {
        var oldDs = debeziumServer(7L, List.of(
                new Condition("Running", Condition.TRUE, null),
                new Condition("Ready", Condition.FALSE, null)));

        var newDs = debeziumServer(7L, List.of(
                new Condition("Running", Condition.TRUE, null),
                new Condition("Ready", Condition.TRUE, null)));

        watcher.reconcile(oldDs, newDs);

        verify(statusChangedEvent).fire(eventCaptor.capture());
        assertThat(eventCaptor.getValue().pipelineId()).isEqualTo(7L);
        assertThat(eventCaptor.getValue().status()).isEqualTo(PipelineStatus.RUNNING);
    }

    @Test
    @DisplayName("Should not fire event on update when status unchanged")
    void reconcileOnUpdateNoEventWhenStatusUnchanged() {
        var conditions = List.of(
                new Condition("Ready", Condition.TRUE, null),
                new Condition("Running", Condition.TRUE, null));

        var oldDs = debeziumServer(7L, conditions);
        var newDs = debeziumServer(7L, conditions);

        watcher.reconcile(oldDs, newDs);

        verify(statusChangedEvent, never()).fire(any());
    }

    @Test
    @DisplayName("Should include error message on update when status is FAILED")
    void reconcileOnUpdateIncludesErrorMessage() {
        var oldDs = debeziumServer(7L, List.of(
                new Condition("Running", Condition.TRUE, null)));

        var newDs = debeziumServer(7L, List.of(
                new Condition("Running", Condition.FALSE, "Connector task failed"),
                new Condition("Ready", Condition.FALSE, "Not ready")));

        watcher.reconcile(oldDs, newDs);

        verify(statusChangedEvent).fire(eventCaptor.capture());
        assertThat(eventCaptor.getValue().status()).isEqualTo(PipelineStatus.FAILED);
        assertThat(eventCaptor.getValue().message()).isEqualTo("Connector task failed");
    }

    @Test
    @DisplayName("Should fire FAILED on update when transitioning from RUNNING to Ready=False without Running condition")
    void reconcileOnUpdateFiresFailedOnCrashLoopBackOff() {
        var oldDs = debeziumServer(7L, List.of(
                new Condition("Ready", Condition.TRUE, null),
                new Condition("Running", Condition.TRUE, null)));

        var newDs = debeziumServer(7L, List.of(
                new Condition("Ready", Condition.FALSE, "Server database-migration is being deployed")));

        watcher.reconcile(oldDs, newDs);

        verify(statusChangedEvent).fire(eventCaptor.capture());
        assertThat(eventCaptor.getValue().pipelineId()).isEqualTo(7L);
        assertThat(eventCaptor.getValue().status()).isEqualTo(PipelineStatus.FAILED);
        assertThat(eventCaptor.getValue().message()).isEqualTo("Pipeline failed unexpectedly. Check the pipeline logs for details.");
    }

    @Test
    @DisplayName("Should not fire FAILED when Ready=False is initial deployment, not a transition from RUNNING")
    void reconcileOnUpdateNoFailedForInitialDeployment() {
        var oldDs = debeziumServer(7L, List.of(
                new Condition("Ready", Condition.FALSE, "Server is being deployed")));

        var newDs = debeziumServer(7L, List.of(
                new Condition("Ready", Condition.FALSE, "Server is being deployed")));

        watcher.reconcile(oldDs, newDs);

        verify(statusChangedEvent, never()).fire(any());
    }

    @Test
    @DisplayName("Should not include error message on update when status is not FAILED")
    void reconcileOnUpdateNoErrorMessageWhenNotFailed() {
        var oldDs = debeziumServer(7L, List.of(
                new Condition("Running", Condition.TRUE, null)));

        var newDs = debeziumServer(7L, List.of(
                new Condition("Ready", Condition.TRUE, null),
                new Condition("Running", Condition.TRUE, null)));

        watcher.reconcile(oldDs, newDs);

        verify(statusChangedEvent).fire(eventCaptor.capture());
        assertThat(eventCaptor.getValue().message()).isNull();
    }

    private static DebeziumServer debeziumServer(Long pipelineId, List<Condition> conditions) {
        var ds = new DebeziumServer();
        var metadata = new ObjectMeta();
        metadata.setLabels(Map.of(LABEL_DBZ_CONDUCTOR_ID, String.valueOf(pipelineId)));
        ds.setMetadata(metadata);
        if (conditions != null) {
            var status = new DebeziumServerStatus();
            status.setConditions(conditions);
            ds.setStatus(status);
        }
        return ds;
    }
}
