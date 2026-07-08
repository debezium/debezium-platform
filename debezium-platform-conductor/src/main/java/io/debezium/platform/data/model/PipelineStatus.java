/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

/**
     * Represents the user-facing status of a pipeline, independent of the environment it is deployed to.
 *
 * <p>This is a higher level concept than {@link DeploymentStatus}, which tracks the state of an
 * individual deployment on a remote host and carries infrastructure level details such as
 * {@code CONFIG_DRIFT}.</p>
 *
 * <ul>
 *   <li>{@code DEPLOYING} — deployment has been requested and is awaiting confirmation</li>
 *   <li>{@code RUNNING} — pipeline is running normally</li>
 *   <li>{@code STOPPED} — pipeline was explicitly stopped by the user</li>
 *   <li>{@code FAILED} — pipeline could not be deployed or stopped running unexpectedly</li>
 * </ul>
 */
public enum PipelineStatus {
    DEPLOYING,
    RUNNING,
    STOPPED,
    FAILED
}
