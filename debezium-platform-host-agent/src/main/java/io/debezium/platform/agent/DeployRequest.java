/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * Request body for the {@code POST /api/agent/deploy} endpoint.
 *
 * <p>Contains everything the Agent needs to start a Debezium Server container:
 * the container name, Docker image, host port to bind, and the full
 * {@code application.properties} content that will be written to disk
 * and bind-mounted into the container.
 *
 * @param containerName  Docker container name (e.g. {@code debezium-pipeline-42})
 * @param image          Docker image to run (e.g. {@code quay.io/debezium/server:latest})
 * @param port           host port to map to the container's 8080
 * @param configContent  full {@code application.properties} content for Debezium Server
 */
public record DeployRequest(
        @NotBlank(message = "A container name is required") @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9_.-]*", message = "The container name contains unsupported characters") String containerName,
        @NotBlank(message = "A container image is required") String image,
        @Min(value = 1, message = "The container port must be between 1 and 65535") @Max(value = 65_535, message = "The container port must be between 1 and 65535") int port,
        @NotNull(message = "Container configuration is required") String configContent) {
}
