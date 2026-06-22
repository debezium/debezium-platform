/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

/**
 * Represents the runtime status of a pipeline deployment on a remote host.
 *
 * <ul>
 *   <li>{@code DEPLOYING} — Docker container creation requested, awaiting confirmation</li>
 *   <li>{@code RUNNING} — container is running normally</li>
 *   <li>{@code STOPPED} — container was explicitly stopped by the user</li>
 *   <li>{@code FAILED} — container exited unexpectedly or Agent is unreachable</li>
 *   <li>{@code CONFIG_DRIFT} — SHA-256 hash of deployed config does not match expected hash</li>
 * </ul>
 */
public enum DeploymentStatus {
    DEPLOYING,
    RUNNING,
    STOPPED,
    FAILED,
    CONFIG_DRIFT
}
