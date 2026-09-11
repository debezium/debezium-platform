/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

/**
 * Response body for the {@code GET /api/agent/status/{containerName}} endpoint.
 *
 * <p>Reports whether the Docker container is currently running and
 * the SHA-256 hash of the deployed {@code application.properties} file.
 * The Conductor's status poller uses these two fields to detect:
 * <ul>
 *   <li>Container health — {@code running = true/false}</li>
 *   <li>Config drift — comparing {@code configHash} against the expected
 *       hash stored in {@code HostDeploymentEntity.configHash}</li>
 * </ul>
 *
 * <p>When the container does not exist at all (e.g. after {@code docker rm}),
 * the endpoint returns {@code 404 Not Found} instead of this object. This
 * distinction allows the Conductor to differentiate "container stopped"
 * from "container was removed."
 *
 * @param running     {@code true} if the container is currently running
 * @param configHash  SHA-256 hash of the deployed config file, or {@code null}
 *                    if the config file does not exist on disk
 */
public record ContainerStatus(
        boolean running,
        String configHash) {
}
