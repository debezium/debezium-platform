/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.agent;

/**
 * Status response from the remote Host Agent.
 *
 * <p>Mirrors the Agent-side {@code ContainerStatus} record. Used by the
 * Conductor's {@link HostAgentClient} to interpret status poll responses.
 *
 * @param running     {@code true} if the container is currently running
 * @param configHash  SHA-256 hash of the deployed config file
 */
public record AgentContainerStatus(
        boolean running,
        String configHash) {
}
