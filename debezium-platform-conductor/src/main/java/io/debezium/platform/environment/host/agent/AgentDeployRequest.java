/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.agent;

/**
 * Deploy request sent from the Conductor to the remote Host Agent.
 *
 * <p>Mirrors the Agent-side {@code DeployRequest} record. Contains
 * everything the Agent needs to start a Debezium Server container.
 *
 * @param containerName  Docker container name
 * @param image          Docker image to run
 * @param port           host port to bind
 * @param configContent  full {@code application.properties} content
 */
public record AgentDeployRequest(
        String containerName,
        String image,
        int port,
        String configContent) {
}
