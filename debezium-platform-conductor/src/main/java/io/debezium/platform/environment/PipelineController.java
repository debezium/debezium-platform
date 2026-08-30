/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment;

import io.debezium.platform.domain.Signal;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.environment.logs.LogReader;

/**
 * Pipeline environment controller
 */
public interface PipelineController {

    /**
     * Deploys the pipeline into target environment
     * <p>
     * This method should never be called directly, instead rely on Outbox to
     * guarantee the pipeline creation;
     * </p>
     *
     * @param pipeline the pipeline to deploy
     */
    void deploy(PipelineFlat pipeline);

    /**
     * Undeploys the pipeline with given id from target environment
     * <p>
     * This method should never be called directly, instead rely on Outbox to
     * guarantee the pipeline removal;
     * </p>
     *
     * @param id the pipeline id
     */
    void undeploy(Long id);

    /**
     * Synchronously undeploys the pipeline with given id from the target environment.
     * <p>
     * Unlike {@link #undeploy(Long)}, this method runs on the <em>caller's thread</em>
     * and blocks until the deployment is fully cleaned up (container stopped, removed,
     * and deployment record deleted).
     * </p>
     * <p>
     * Called directly by {@code PipelineService.delete()} as a pre-condition to
     * satisfy the FK constraint between {@code host_deployment} and {@code pipeline}.
     * This is an intentional exception to the "rely on Outbox" rule — the delete path
     * <em>requires</em> synchronous cleanup before the pipeline row can be removed.
     * </p>
     *
     * @param id the pipeline id
     */
    void undeploySync(Long id);

    /**
     * Stops the pipeline with given id
     *
     * @param id the pipeline id
     */
    void stop(Long id);

    /**
     * Starts the pipeline with given id
     *
     * @param id the pipeline id
     */
    void start(Long id);

    /**
     * Returns the {@link LogReader} instance for the given pipeline
     *
     * @param id the pipeline id
     * @return {@link LogReader} instance for the given pipeline
     */
    LogReader logReader(Long id);

    void sendSignal(Long pipelineId, Signal signal);
}
