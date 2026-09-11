/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

/**
 * Container lifecycle service for the Host Agent.
 *
 * <p>The REST resource delegates all filesystem and process work here. This
 * keeps request validation and HTTP response mapping separate from the local
 * container-management workflow.
 */
@ApplicationScoped
public class AgentContainerService {

    private static final String CONFIG_FILE_NAME = "application.properties";
    private static final String DEBEZIUM_SERVER_USER = "185:0";
    private static final List<String> CONTAINER_NOT_FOUND_MARKERS = List.of(
            "no such object",
            "no such container");

    private final Logger logger;
    private final DockerCommandRunner commandRunner;
    private final AgentConfig config;

    public AgentContainerService(Logger logger, DockerCommandRunner commandRunner, AgentConfig config) {
        this.logger = logger;
        this.commandRunner = commandRunner;
        this.config = config;
    }

    /**
     * Prepares local state and asynchronously starts a Debezium Server container.
     */
    public void deploy(DeployRequest request) {
        String containerName = request.containerName();
        Path configDirectory = containerDirectory(config.configBasePath(), containerName);
        Path configPath = configDirectory.resolve(CONFIG_FILE_NAME);
        Path dataDirectory = containerDirectory(config.dataBasePath(), containerName);

        try {
            Files.createDirectories(configDirectory);
            Files.createDirectories(dataDirectory);
            ensureSuccess(commandRunner.run(new ChangeOwnershipCommand(DEBEZIUM_SERVER_USER, dataDirectory)),
                    "Failed to assign data directory ownership for " + containerName);
            Files.writeString(configPath, request.configContent(), StandardCharsets.UTF_8);
        }
        catch (IOException e) {
            throw new AgentOperationException("Failed to prepare deployment for " + containerName, e);
        }

        removeStaleContainer(containerName);
        commandRunner.runAsync(DockerCommand.run(containerName, request.image(), request.port(),
                configPath.toString(), dataDirectory.toString(), DEBEZIUM_SERVER_USER));
        logger.infov("Deployment started for container {0}, image {1}, port {2}",
                containerName, request.image(), request.port());
    }

    /**
     * Gracefully stops a container before force-removing it and cleaning its files.
     */
    public void undeploy(String containerName) {
        try {
            stop(containerName);
        }
        catch (AgentOperationException e) {
            logger.debugv("Container {0} could not be stopped before removal: {1}",
                    containerName, e.getMessage());
        }

        removeStaleContainer(containerName);
        cleanupContainerFiles(containerName);
        logger.infov("Undeployed container {0}", containerName);
    }

    /**
     * Gracefully stops a running container.
     */
    public void stop(String containerName) {
        ensureSuccess(commandRunner.run(DockerCommand.stop(containerName)),
                "Failed to stop container " + containerName);
    }

    /**
     * Starts a previously stopped container.
     */
    public void start(String containerName) {
        ensureSuccess(commandRunner.run(DockerCommand.start(containerName)),
                "Failed to start container " + containerName);
    }

    /**
     * Returns a container's runtime state and optional configuration hash.
     */
    public Optional<ContainerStatus> status(String containerName) {
        DockerCommandRunner.CommandOutput result = commandRunner.run(DockerCommand.inspectRunning(containerName));
        if (!result.isSuccess()) {
            if (isContainerNotFound(result.output())) {
                return Optional.empty();
            }
            throw new AgentOperationException("Failed to inspect container " + containerName + ": " + result.output());
        }

        boolean running = result.output().trim().equalsIgnoreCase("true");
        return Optional.of(new ContainerStatus(running, computeConfigHash(containerName).orElse(null)));
    }

    /**
     * Returns the last 500 lines of a container's logs.
     */
    public String logs(String containerName) {
        DockerCommandRunner.CommandOutput result = commandRunner.run(DockerCommand.logs(containerName));
        ensureSuccess(result, "Failed to retrieve logs for container " + containerName);
        return result.output();
    }

    /**
     * Computes the deployed configuration hash when the configuration file exists.
     */
    Optional<String> computeConfigHash(String containerName) {
        Path configPath = containerDirectory(config.configBasePath(), containerName).resolve(CONFIG_FILE_NAME);
        if (!Files.exists(configPath)) {
            return Optional.empty();
        }

        try {
            byte[] content = Files.readAllBytes(configPath);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Optional.of(HexFormat.of().formatHex(digest.digest(content)));
        }
        catch (IOException | NoSuchAlgorithmException e) {
            logger.warnv(e, "Failed to compute config hash for container {0}", containerName);
            return Optional.empty();
        }
    }

    private void removeStaleContainer(String containerName) {
        DockerCommandRunner.CommandOutput result = commandRunner.run(DockerCommand.remove(containerName));
        if (!result.isSuccess() && !isContainerNotFound(result.output())) {
            throw new AgentOperationException("Failed to remove container " + containerName + ": " + result.output());
        }
    }

    private void cleanupContainerFiles(String containerName) {
        try {
            deleteDirectoryRecursively(containerDirectory(config.configBasePath(), containerName));
            deleteDirectoryRecursively(containerDirectory(config.dataBasePath(), containerName));
        }
        catch (IOException e) {
            logger.warnv(e, "Failed to clean up files for container {0}, proceeding", containerName);
        }
    }

    private static Path containerDirectory(String basePath, String containerName) {
        Path baseDirectory = Path.of(basePath).toAbsolutePath().normalize();
        Path containerDirectory = baseDirectory.resolve(containerName).normalize();
        if (!containerDirectory.startsWith(baseDirectory) || containerDirectory.equals(baseDirectory)) {
            throw new AgentOperationException("Invalid container name: " + containerName);
        }
        return containerDirectory;
    }

    private static void deleteDirectoryRecursively(Path directory) throws IOException {
        if (Files.exists(directory)) {
            try (var walker = Files.walk(directory)) {
                List<Path> paths = walker.sorted(Comparator.reverseOrder()).toList();
                for (Path path : paths) {
                    Files.deleteIfExists(path);
                }
            }
        }
    }

    private static void ensureSuccess(DockerCommandRunner.CommandOutput result, String message) {
        if (!result.isSuccess()) {
            throw new AgentOperationException(message + ": " + result.output());
        }
    }

    private static boolean isContainerNotFound(String output) {
        if (output == null) {
            return false;
        }
        String lowerOutput = output.toLowerCase();
        return CONTAINER_NOT_FOUND_MARKERS.stream().anyMatch(lowerOutput::contains);
    }
}
