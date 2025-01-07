/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment;

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

}
