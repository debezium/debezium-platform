/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment;

import io.debezium.platform.data.model.PipelineStatus;

/**
 * CDI event fired by environment-specific status watchers when the observed state
 * of a deployed Debezium Server instance changes.
 *
 * <p>This event is environment-agnostic: it can originate from a Kubernetes CR informer,
 * a host-based health poller, or any other deployment mechanism. Observers in the domain
 * layer reconcile it into the canonical {@link PipelineStatus} persisted on the pipeline entity.</p>
 *
 * @param pipelineId the pipeline whose deployed instance changed state
 * @param status     the status derived from the environment signal
 * @param message    optional detail (e.g. error message from a failed condition), may be {@code null}
 */
public record DebeziumServerStatusChanged(Long pipelineId, PipelineStatus status, String message) {
}
