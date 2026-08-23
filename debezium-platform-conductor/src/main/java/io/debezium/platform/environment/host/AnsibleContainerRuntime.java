/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

import io.debezium.DebeziumException;
import io.debezium.platform.environment.host.config.HostConfigGroup;
import io.debezium.platform.environment.host.provisioning.AnsibleCommandRunner;
import io.debezium.platform.environment.host.provisioning.CommandResult;

/**
 * Ansible-based implementation of {@link HostContainerRuntime}.
 *
 * <p>Translates container lifecycle operations into Ansible ad-hoc
 * commands executed via SSH. Each method delegates to
 * {@link AnsibleCommandRunner} for the actual process invocation.
 *
 * <p>When the Host Agent replaces Ansible (sub-issue 7+), a new
 * implementation will call the agent's REST API instead.
 */
@ApplicationScoped
public class AnsibleContainerRuntime implements HostContainerRuntime {

    private static final String DOCKER_RUN_FORMAT = "docker run -d --user $(id -u):$(id -g) --name %s -p %d:8080 -v %s:/debezium/config/application.properties -v %s:/debezium/data %s";
    private static final String DOCKER_RM_FORMAT = "docker rm -f %s";
    private static final String DOCKER_STOP_FORMAT = "docker stop %s";
    private static final String DOCKER_START_FORMAT = "docker start %s";
    private static final String DOCKER_LOGS_FORMAT = "docker logs --tail 500 %s";
    private static final String CONFIG_FILE_NAME = "application.properties";
    private static final String PATH_SEPARATOR = "/";

    private final Logger logger;
    private final AnsibleCommandRunner ansibleRunner;
    private final HostConfigGroup hostConfig;

    public AnsibleContainerRuntime(Logger logger,
                                   AnsibleCommandRunner ansibleRunner,
                                   HostConfigGroup hostConfig) {
        this.logger = logger;
        this.ansibleRunner = ansibleRunner;
        this.hostConfig = hostConfig;
    }

    @Override
    public void deploy(String host, String containerName, int port, String configContent, String image) {
        String configDir = hostConfig.configBasePath() + PATH_SEPARATOR + containerName;
        String configPath = configDir + PATH_SEPARATOR + CONFIG_FILE_NAME;
        String dataDir = hostConfig.dataBasePath() + PATH_SEPARATOR + containerName;

        createConfigDirectory(host, configDir);
        createDataDirectory(host, dataDir);
        uploadConfiguration(host, configContent, configPath);
        removeStaleContainer(host, containerName);
        startContainer(host, containerName, port, configPath, dataDir, image);

        logger.infov("Container {0} started on {1}, port {2}", containerName, host, port);
    }

    @Override
    public void undeploy(String host, String containerName) {
        CommandResult result = ansibleRunner.runShellCommand(host,
                String.format(DOCKER_RM_FORMAT, containerName));
        if (result instanceof CommandResult.Failure failure) {
            logger.warnv("docker rm -f failed for {0} on {1}: {2} — proceeding",
                    containerName, host, failure.output());
        }
    }

    @Override
    public void stop(String host, String containerName) {
        CommandResult result = ansibleRunner.runShellCommand(host,
                String.format(DOCKER_STOP_FORMAT, containerName));
        if (result instanceof CommandResult.Failure failure) {
            throw new DebeziumException("Failed to stop container " + containerName + ": " + failure.output());
        }
    }

    @Override
    public void start(String host, String containerName) {
        CommandResult result = ansibleRunner.runShellCommand(host,
                String.format(DOCKER_START_FORMAT, containerName));
        if (result instanceof CommandResult.Failure failure) {
            throw new DebeziumException("Failed to start container " + containerName + ": " + failure.output());
        }
    }

    @Override
    public String logs(String host, String containerName) {
        CommandResult result = ansibleRunner.runShellCommand(host,
                String.format(DOCKER_LOGS_FORMAT, containerName));
        return switch (result) {
            case CommandResult.Success success -> success.output();
            case CommandResult.Failure failure -> "[Log retrieval failed: " + failure.output() + "]";
        };
    }

    // ── Self-documenting deploy steps ──

    private void createConfigDirectory(String host, String configDir) {
        CommandResult result = ansibleRunner.createDirectory(host, configDir);
        if (result instanceof CommandResult.Failure failure) {
            throw new DebeziumException("Failed to create config directory on " + host + ": " + failure.output());
        }
    }

    private void createDataDirectory(String host, String dataDir) {
        CommandResult result = ansibleRunner.createDirectory(host, dataDir);
        if (result instanceof CommandResult.Failure failure) {
            throw new DebeziumException("Failed to create data directory on " + host + ": " + failure.output());
        }
    }

    private void uploadConfiguration(String host, String configContent, String configPath) {
        CommandResult result = ansibleRunner.copyContent(host, configContent, configPath);
        if (result instanceof CommandResult.Failure failure) {
            throw new DebeziumException("Failed to copy config to " + host + ": " + failure.output());
        }
    }

    private void removeStaleContainer(String host, String containerName) {
        ansibleRunner.runShellCommand(host, String.format(DOCKER_RM_FORMAT, containerName));
    }

    private void startContainer(String host, String containerName, int port,
                                String configPath, String dataDir, String image) {
        String dockerCommand = String.format(DOCKER_RUN_FORMAT,
                containerName, port, configPath, dataDir, image);
        CommandResult result = ansibleRunner.runShellCommand(host, dockerCommand);
        if (result instanceof CommandResult.Failure failure) {
            throw new DebeziumException("Docker run failed on " + host + ": " + failure.output());
        }
    }
}
