/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator;

import java.util.Optional;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.Instance;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.operator.api.model.DebeziumServer;
import io.debezium.operator.api.model.status.Condition;
import io.debezium.platform.data.model.PipelineStatus;
import io.debezium.platform.environment.DebeziumServerStatusChanged;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.informers.ResourceEventHandler;
import io.fabric8.kubernetes.client.informers.SharedIndexInformer;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;

/**
 * Watches {@link DebeziumServer} CR status changes via a Kubernetes informer and
 * translates operator conditions into {@link DebeziumServerStatusChanged} CDI events.
 *
 * <p>Active only when {@code platform.deployment.mode=operator}. Uses
 * {@link Instance} for the {@link KubernetesClient} so the actual client is never
 * resolved in host mode.</p>
 *
 * <p>Condition-to-status mapping (matches the operator's {@code ServerRunningCondition}
 * / {@code ServerStoppedCondition} model where both use type {@code Running}):
 * <ul>
 *   <li>{@code Ready = True} and {@code Running = False} → {@link PipelineStatus#STOPPED}</li>
 *   <li>{@code Ready = True} (and Running is not False) → {@link PipelineStatus#RUNNING}</li>
 *   <li>{@code Ready = False} and {@code Running = False} → {@link PipelineStatus#FAILED}
 *       (explicit failure reported by the operator)</li>
 *   <li>Transition from {@code RUNNING} to {@code Ready = False} (without Running condition)
 *       → {@link PipelineStatus#FAILED} (detects CrashLoopBackOff; fallback for operator
 *       versions that do not set {@code Running = False} on failure)</li>
 *   <li>Otherwise (e.g. deployment in progress) → no event (stay in current state)</li>
 * </ul>
 */
@ApplicationScoped
public class OperatorPipelineStatusWatcher {

    private static final Logger LOGGER = LoggerFactory.getLogger(OperatorPipelineStatusWatcher.class);

    private static final String OPERATOR_DEPLOYMENT_MODE = "operator";
    private static final String CONDITION_READY = "Ready";
    private static final String CONDITION_RUNNING = "Running";
    private static final String TRANSITION_FAILED_MESSAGE = "Pipeline failed unexpectedly. Check the pipeline logs for details.";

    private final Instance<KubernetesClient> kubernetesClient;
    private final Event<DebeziumServerStatusChanged> statusChangedEvent;

    @ConfigProperty(name = "platform.deployment.mode", defaultValue = "operator")
    String deploymentMode;

    private SharedIndexInformer<DebeziumServer> informer;

    public OperatorPipelineStatusWatcher(Instance<KubernetesClient> kubernetesClient,
                                         Event<DebeziumServerStatusChanged> statusChangedEvent) {
        this.kubernetesClient = kubernetesClient;
        this.statusChangedEvent = statusChangedEvent;
    }

    void onStart(@Observes StartupEvent event) {
        if (!isOperatorMode()) {
            LOGGER.debug("Skipping pipeline status watcher: deployment mode is '{}'", deploymentMode);
            return;
        }
        startInformer();
    }

    void onStop(@Observes ShutdownEvent event) {
        if (informer != null) {
            LOGGER.info("Stopping DebeziumServer CR status watcher");
            informer.close();
        }
    }

    private void startInformer() {
        try {
            var client = kubernetesClient.get();
            informer = client.resources(DebeziumServer.class)
                    .inform(new ResourceEventHandler<>() {
                        @Override
                        public void onAdd(DebeziumServer obj) {
                            reconcile(obj);
                        }

                        @Override
                        public void onUpdate(DebeziumServer oldObj, DebeziumServer newObj) {
                            reconcile(oldObj, newObj);
                        }

                        @Override
                        public void onDelete(DebeziumServer obj, boolean deletedFinalStateUnknown) {
                            // no-op: deletion is handled by the undeploy flow
                        }
                    });
            LOGGER.info("DebeziumServer CR status watcher started successfully");
        }
        catch (Exception e) {
            LOGGER.warn("Unable to start DebeziumServer CR status watcher: {}", e.getMessage());
        }
    }

    void reconcile(DebeziumServer ds) {
        extractPipelineId(ds).ifPresent(pipelineId -> mapConditionsToStatus(ds).ifPresent(status -> {
            var message = extractErrorMessage(ds, status);
            LOGGER.debug("Pipeline {} status: {}", pipelineId, status);
            statusChangedEvent.fire(new DebeziumServerStatusChanged(pipelineId, status, message));
        }));
    }

    void reconcile(DebeziumServer oldDs, DebeziumServer newDs) {
        var oldStatus = mapConditionsToStatus(oldDs);
        var resolvedStatus = mapConditionsToStatus(newDs);

        // The operator never sets Running=False; when a pod crashes (CrashLoopBackOff),
        // Ready simply flips back to False. Detect this by checking the transition:
        // previously RUNNING + now Ready=False (without Running condition) = FAILED.
        var failedViaTransition = false;
        if (resolvedStatus.isEmpty()
                && oldStatus.filter(s -> s == PipelineStatus.RUNNING).isPresent()
                && hasCondition(newDs, CONDITION_READY, Condition.FALSE)) {
            resolvedStatus = Optional.of(PipelineStatus.FAILED);
            failedViaTransition = true;
        }

        if (resolvedStatus.isPresent() && !resolvedStatus.equals(oldStatus)) {
            var status = resolvedStatus.get();
            var message = failedViaTransition
                    ? TRANSITION_FAILED_MESSAGE
                    : extractErrorMessage(newDs, status);
            extractPipelineId(newDs).ifPresent(pipelineId -> {
                LOGGER.info("Pipeline {} status changed from {} to {}", pipelineId,
                        oldStatus.orElse(null), status);
                statusChangedEvent.fire(new DebeziumServerStatusChanged(pipelineId, status, message));
            });
        }
    }

    private Optional<PipelineStatus> mapConditionsToStatus(DebeziumServer ds) {
        var serverStatus = ds.getStatus();
        if (serverStatus == null) {
            return Optional.empty();
        }
        var conditions = serverStatus.getConditions();
        if (conditions == null || conditions.isEmpty()) {
            return Optional.empty();
        }

        var conditionMap = conditions.stream()
                .collect(Collectors.toMap(Condition::getType, c -> c));

        var ready = conditionMap.get(CONDITION_READY);
        if (ready != null && Condition.TRUE.equals(ready.getStatus())) {
            var running = conditionMap.get(CONDITION_RUNNING);
            if (running != null && Condition.FALSE.equals(running.getStatus())) {
                return Optional.of(PipelineStatus.STOPPED);
            }
            return Optional.of(PipelineStatus.RUNNING);
        }

        var running = conditionMap.get(CONDITION_RUNNING);
        if (running != null && Condition.FALSE.equals(running.getStatus())) {
            return Optional.of(PipelineStatus.FAILED);
        }

        return Optional.empty();
    }

    private Optional<Long> extractPipelineId(DebeziumServer ds) {
        var labels = ds.getMetadata().getLabels();
        if (labels == null) {
            return Optional.empty();
        }
        var idStr = labels.get(OperatorPipelineController.LABEL_DBZ_CONDUCTOR_ID);
        if (idStr == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(Long.valueOf(idStr));
        }
        catch (NumberFormatException e) {
            LOGGER.warn("Invalid conductor-id label value: {}", idStr);
            return Optional.empty();
        }
    }

    private String extractErrorMessage(DebeziumServer ds, PipelineStatus status) {
        if (status != PipelineStatus.FAILED) {
            return null;
        }
        var conditions = ds.getStatus().getConditions();
        if (conditions == null) {
            return null;
        }
        return conditions.stream()
                .filter(c -> CONDITION_READY.equals(c.getType()) || CONDITION_RUNNING.equals(c.getType()))
                .filter(c -> Condition.FALSE.equals(c.getStatus()))
                .map(Condition::getMessage)
                .filter(m -> m != null && !m.isBlank())
                .findFirst()
                .orElse(null);
    }

    private boolean hasCondition(DebeziumServer ds, String type, String status) {
        var serverStatus = ds.getStatus();
        if (serverStatus == null || serverStatus.getConditions() == null) {
            return false;
        }
        return serverStatus.getConditions().stream()
                .anyMatch(c -> type.equals(c.getType()) && status.equals(c.getStatus()));
    }

    private boolean isOperatorMode() {
        return OPERATOR_DEPLOYMENT_MODE.equals(deploymentMode);
    }
}
