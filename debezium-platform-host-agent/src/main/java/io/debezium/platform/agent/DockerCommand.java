/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import java.util.List;

/**
 * Docker CLI command used by {@link AgentContainerService}.
 */
public record DockerCommand(List<String> arguments) implements HostCommand {

    private static final String DOCKER = "docker";

    public DockerCommand {
        arguments = List.copyOf(arguments);
    }

    public static DockerCommand remove(String containerName) {
        return new DockerCommand(List.of(DOCKER, "rm", "-f", containerName));
    }

    public static DockerCommand stop(String containerName) {
        return new DockerCommand(List.of(DOCKER, "stop", containerName));
    }

    public static DockerCommand start(String containerName) {
        return new DockerCommand(List.of(DOCKER, "start", containerName));
    }

    public static DockerCommand inspectRunning(String containerName) {
        return new DockerCommand(List.of(DOCKER, "inspect", "--format", "{{.State.Running}}", containerName));
    }

    public static DockerCommand logs(String containerName) {
        return new DockerCommand(List.of(DOCKER, "logs", "--tail", "500", containerName));
    }

    public static DockerCommand run(String containerName, String image, int port,
                                    String configPath, String dataDirectory, String user) {
        return new DockerCommand(List.of(
                DOCKER, "run", "-d",
                "--name", containerName,
                "--user", user,
                "-p", port + ":8080",
                "-v", configPath + ":/debezium/config/application.properties",
                "-v", dataDirectory + ":/debezium/data",
                image));
    }
}
