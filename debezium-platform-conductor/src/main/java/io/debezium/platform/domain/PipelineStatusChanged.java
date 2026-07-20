/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import io.debezium.platform.data.model.PipelineStatus;

/**
 * Domain event published once a pipeline's {@link PipelineStatus} has been persisted.
 *
 * <p>This is the pipeline lifecycle extension point. Components that need to react to a status
 * change (propagation to the UI, metrics, notifications) observe this event with
 * {@code @Observes(during = TransactionPhase.AFTER_SUCCESS)} so that they run only after the
 * status write has committed. Because the write commits first, a failing observer cannot roll it
 * back, and an observer exception is not propagated back onto the engine thread that requested the
 * status change.</p>
 *
 * @param pipelineId   the pipeline whose status changed
 * @param status       the newly persisted status
 * @param errorMessage the persisted error message when {@code status} is {@link PipelineStatus#FAILED}, otherwise {@code null}
 */
public record PipelineStatusChanged(Long pipelineId, PipelineStatus status, String errorMessage) {
}
