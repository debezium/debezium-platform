/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator;

import static io.debezium.platform.environment.operator.OperatorPipelineController.LABEL_DBZ_CONDUCTOR_ID;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import jakarta.enterprise.event.Event;
import jakarta.enterprise.inject.Instance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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

    OperatorPipelineStatusWatcher watcher;

    @BeforeEach
    void setUp() {
        watcher = new OperatorPipelineStatusWatcher(kubernetesClient, statusChangedEvent);
    }

    @Test
    @DisplayName("Should resolve STOPPED when Ready=True and Running=False")
    void reconcileResolvesStopped() {
        var ds = debeziumServer(42L, List.of(
                new Condition("Ready", Condition.TRUE, null),
                new Condition("Running", Condition.FALSE, "Server is stopped")));

        var result = watcher.reconcile(ds);

        assertThat(result).isPresent();
        assertThat(result.get().pipelineId()).isEqualTo(42L);
        assertThat(result.get().status()).isEqualTo(PipelineStatus.STOPPED);
    }

    @Test
    @DisplayName("Should resolve RUNNING when Ready condition is True")
    void reconcileResolvesRunning() {
        var ds = debeziumServer(42L, List.of(
                new Condition("Ready", Condition.TRUE, null),
                new Condition("Running", Condition.TRUE, null)));

        var result = watcher.reconcile(ds);

        assertThat(result).isPresent();
        assertThat(result.get().status()).isEqualTo(PipelineStatus.RUNNING);
        assertThat(result.get().message()).isNull();
    }

    @Test
    @DisplayName("Should resolve FAILED with error message when Running is False and not stopped")
    void reconcileResolvesFailedWithErrorMessage() {
        var ds = debeziumServer(42L, List.of(
                new Condition("Running", Condition.FALSE, "Engine crashed"),
                new Condition("Ready", Condition.FALSE, "Not ready")));

        var result = watcher.reconcile(ds);

        assertThat(result).isPresent();
        assertThat(result.get().status()).isEqualTo(PipelineStatus.FAILED);
        assertThat(result.get().message()).isEqualTo("Engine crashed");
    }

    @Test
    @DisplayName("Ready=True + Running=False maps to STOPPED, not FAILED")
    void reconcileStoppedNotFailed() {
        var ds = debeziumServer(42L, List.of(
                new Condition("Ready", Condition.TRUE, null),
                new Condition("Running", Condition.FALSE, "Server is stopped")));

        var result = watcher.reconcile(ds);

        assertThat(result).isPresent();
        assertThat(result.get().status()).isEqualTo(PipelineStatus.STOPPED);
    }

    @Test
    @DisplayName("Should resolve nothing when Running=True but not yet Ready")
    void reconcileEmptyWhenRunningButNotReady() {
        var ds = debeziumServer(42L, List.of(
                new Condition("Running", Condition.TRUE, null),
                new Condition("Ready", Condition.FALSE, null)));

        assertThat(watcher.reconcile(ds)).isEmpty();
    }

    @Test
    @DisplayName("Should resolve nothing when status is null")
    void reconcileEmptyWhenStatusNull() {
        var ds = debeziumServer(42L, null);

        assertThat(watcher.reconcile(ds)).isEmpty();
    }

    @Test
    @DisplayName("Should resolve nothing when conditions list is empty")
    void reconcileEmptyWhenConditionsEmpty() {
        var ds = debeziumServer(42L, List.of());

        assertThat(watcher.reconcile(ds)).isEmpty();
    }

    @Test
    @DisplayName("Should resolve nothing when pipeline id label is missing")
    void reconcileEmptyWithoutLabel() {
        var ds = new DebeziumServer();
        ds.setMetadata(new ObjectMeta());
        ds.getMetadata().setLabels(Map.of());
        var status = new DebeziumServerStatus();
        status.setConditions(List.of(new Condition("Ready", Condition.TRUE, null)));
        ds.setStatus(status);

        assertThat(watcher.reconcile(ds)).isEmpty();
    }

    @Test
    @DisplayName("Should resolve nothing when labels map is null")
    void reconcileEmptyWhenLabelsNull() {
        var ds = new DebeziumServer();
        ds.setMetadata(new ObjectMeta());
        var status = new DebeziumServerStatus();
        status.setConditions(List.of(new Condition("Ready", Condition.TRUE, null)));
        ds.setStatus(status);

        assertThat(watcher.reconcile(ds)).isEmpty();
    }

    @Test
    @DisplayName("Should resolve nothing when conductor-id label is not a number")
    void reconcileEmptyWhenLabelNotNumeric() {
        var ds = new DebeziumServer();
        ds.setMetadata(new ObjectMeta());
        ds.getMetadata().setLabels(Map.of(LABEL_DBZ_CONDUCTOR_ID, "not-a-number"));
        var status = new DebeziumServerStatus();
        status.setConditions(List.of(new Condition("Ready", Condition.TRUE, null)));
        ds.setStatus(status);

        assertThat(watcher.reconcile(ds)).isEmpty();
    }

    @Test
    @DisplayName("Should resolve event on update when status changes")
    void reconcileOnUpdateResolvesEventOnStatusChange() {
        var oldDs = debeziumServer(7L, List.of(
                new Condition("Running", Condition.TRUE, null),
                new Condition("Ready", Condition.FALSE, null)));

        var newDs = debeziumServer(7L, List.of(
                new Condition("Running", Condition.TRUE, null),
                new Condition("Ready", Condition.TRUE, null)));

        var result = watcher.reconcile(oldDs, newDs);

        assertThat(result).isPresent();
        assertThat(result.get().pipelineId()).isEqualTo(7L);
        assertThat(result.get().status()).isEqualTo(PipelineStatus.RUNNING);
    }

    @Test
    @DisplayName("Should resolve nothing on update when status unchanged")
    void reconcileOnUpdateEmptyWhenStatusUnchanged() {
        var conditions = List.of(
                new Condition("Ready", Condition.TRUE, null),
                new Condition("Running", Condition.TRUE, null));

        var oldDs = debeziumServer(7L, conditions);
        var newDs = debeziumServer(7L, conditions);

        assertThat(watcher.reconcile(oldDs, newDs)).isEmpty();
    }

    @Test
    @DisplayName("Should include error message on update when status is FAILED")
    void reconcileOnUpdateIncludesErrorMessage() {
        var oldDs = debeziumServer(7L, List.of(
                new Condition("Running", Condition.TRUE, null)));

        var newDs = debeziumServer(7L, List.of(
                new Condition("Running", Condition.FALSE, "Connector task failed"),
                new Condition("Ready", Condition.FALSE, "Not ready")));

        var result = watcher.reconcile(oldDs, newDs);

        assertThat(result).isPresent();
        assertThat(result.get().status()).isEqualTo(PipelineStatus.FAILED);
        assertThat(result.get().message()).isEqualTo("Connector task failed");
    }

    @Test
    @DisplayName("Should resolve FAILED on update when transitioning from RUNNING to Ready=False without Running condition")
    void reconcileOnUpdateResolvesFailedOnCrashLoopBackOff() {
        var oldDs = debeziumServer(7L, List.of(
                new Condition("Ready", Condition.TRUE, null),
                new Condition("Running", Condition.TRUE, null)));

        var newDs = debeziumServer(7L, List.of(
                new Condition("Ready", Condition.FALSE, "Server database-migration is being deployed")));

        var result = watcher.reconcile(oldDs, newDs);

        assertThat(result).isPresent();
        assertThat(result.get().pipelineId()).isEqualTo(7L);
        assertThat(result.get().status()).isEqualTo(PipelineStatus.FAILED);
        assertThat(result.get().message()).isEqualTo("Pipeline failed unexpectedly. Check the pipeline logs for details.");
    }

    @Test
    @DisplayName("Should resolve nothing when Ready=False is initial deployment, not a transition from RUNNING")
    void reconcileOnUpdateNoFailedForInitialDeployment() {
        var oldDs = debeziumServer(7L, List.of(
                new Condition("Ready", Condition.FALSE, "Server is being deployed")));

        var newDs = debeziumServer(7L, List.of(
                new Condition("Ready", Condition.FALSE, "Server is being deployed")));

        assertThat(watcher.reconcile(oldDs, newDs)).isEmpty();
    }

    @Test
    @DisplayName("Should not include error message on update when status is not FAILED")
    void reconcileOnUpdateNoErrorMessageWhenNotFailed() {
        var oldDs = debeziumServer(7L, List.of(
                new Condition("Running", Condition.TRUE, null)));

        var newDs = debeziumServer(7L, List.of(
                new Condition("Ready", Condition.TRUE, null),
                new Condition("Running", Condition.TRUE, null)));

        var result = watcher.reconcile(oldDs, newDs);

        assertThat(result).isPresent();
        assertThat(result.get().message()).isNull();
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
