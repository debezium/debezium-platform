/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import io.debezium.platform.domain.HostAllocation;

/**
 * Abstraction for managing Docker containers on a remote host.
 *
 * <p>The current implementation uses Ansible ad-hoc commands
 * ({@link io.debezium.platform.environment.host.AnsibleContainerRuntime}).
 * When the Host Agent is built (sub-issue 7+), a second implementation
 * will delegate to the agent's REST API — no changes needed in
 * {@link HostPipelineController}.
 */
public interface HostContainerRuntime {

    /**
     * Deploys a Debezium Server container on the remote host.
     *
     * <p>Implementations handle all infrastructure steps (directory
     * creation, config file upload, Docker run) as a single operation.
     *
     * @param allocation     the host allocation (target host view and assigned port)
     * @param containerName  the Docker container name
     * @param configContent  the full {@code application.properties} content
     * @param image          the Docker image to run
     * @throws io.debezium.DebeziumException if any step fails
     */
    void deploy(HostAllocation allocation, String containerName, String configContent, String image);

    /**
     * Force-removes a container. Idempotent — succeeds even if the
     * container does not exist.
     *
     * @param host          the SSH alias or hostname
     * @param containerName the Docker container name
     */
    void undeploy(String host, String containerName);

    /**
     * Gracefully stops a running container.
     *
     * @param host          the SSH alias or hostname
     * @param containerName the Docker container name
     * @throws io.debezium.DebeziumException if the stop fails
     */
    void stop(String host, String containerName);

    /**
     * Starts a previously stopped container.
     *
     * @param host          the SSH alias or hostname
     * @param containerName the Docker container name
     * @throws io.debezium.DebeziumException if the start fails
     */
    void start(String host, String containerName);

    /**
     * Retrieves the last 500 lines of container logs.
     *
     * @param host          the SSH alias or hostname
     * @param containerName the Docker container name
     * @return the log output, or a failure message
     */
    String logs(String host, String containerName);
}
