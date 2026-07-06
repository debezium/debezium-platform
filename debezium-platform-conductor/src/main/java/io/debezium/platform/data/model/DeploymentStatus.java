/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

/**
 * Represents the runtime status of a pipeline deployment.
 *
 * <ul>
 *   <li>{@code DEPLOYING} — deployment creation or update has been requested and is awaiting confirmation</li>
 *   <li>{@code RUNNING} — deployment is running normally</li>
 *   <li>{@code STOPPED} — deployment was explicitly stopped by the user</li>
 *   <li>{@code FAILED} — deployment failed, exited unexpectedly, or the runtime is unreachable</li>
 *   <li>{@code CONFIG_DRIFT} — deployed configuration does not match the expected configuration</li>
 * </ul>
 */
public enum DeploymentStatus {
    DEPLOYING,
    RUNNING,
    STOPPED,
    FAILED,
    CONFIG_DRIFT
}
