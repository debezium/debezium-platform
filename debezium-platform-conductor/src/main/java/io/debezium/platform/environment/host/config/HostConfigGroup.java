/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.config;

import java.util.Optional;

import io.quarkus.runtime.annotations.ConfigPhase;
import io.quarkus.runtime.annotations.ConfigRoot;
import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.smallrye.config.WithName;

/**
 * Centralized configuration for the host-based deployment mode.
 *
 * <p>Properties are mapped under the {@code platform.host} prefix:
 * <pre>
 *   platform.host.ssh-config-path=~/.ssh/config
 *   platform.host.ansible-playbook-path=/custom/path/to/host-setup.yml  (optional)
 *   platform.host.ansible-teardown-path=/custom/path/to/host-teardown.yml  (optional)
 *   platform.host.ansible-timeout-minutes=30
 *   platform.host.executor-pool-size=4
 *   platform.host.shutdown-timeout-seconds=5
 *   platform.host.reconciliation-interval=5m
 * </pre>
 */
@ConfigMapping(prefix = "platform.host")
@ConfigRoot(phase = ConfigPhase.RUN_TIME)
public interface HostConfigGroup {

    @WithName("ssh-config-path")
    @WithDefault("~/.ssh/config")
    String sshConfigPath();

    @WithName("ansible-playbook-path")
    Optional<String> ansiblePlaybookPath();

    @WithName("ansible-teardown-path")
    Optional<String> ansibleTeardownPath();

    @WithName("ansible-timeout-minutes")
    @WithDefault("30")
    int ansibleTimeoutMinutes();

    @WithName("executor-pool-size")
    @WithDefault("4")
    int executorPoolSize();

    @WithName("shutdown-timeout-seconds")
    @WithDefault("5")
    long shutdownTimeoutSeconds();

    /**
     * Interval between periodic SSH config reconciliations.
     * The WatchService handles real-time events; this fallback catches
     * events missed on NFS mounts and Kubernetes ConfigMap volumes.
     * Accepts Quarkus duration format, e.g. {@code 5m}, {@code 30s}.
     */
    @WithName("reconciliation-interval")
    @WithDefault("30s")
    String reconciliationInterval();

    /**
     * Starting port number for pipeline deployment port allocation.
     * Each new pipeline on a host gets {@code MAX(existing ports) + 1},
     * starting from this base when the host has no existing deployments.
     */
    @WithName("base-port")
    @WithDefault("9000")
    int basePort();

    /**
     * Prefix for Docker container names on remote hosts.
     * The full container name is {@code <prefix><pipeline-id>}.
     */
    @WithName("container-name-prefix")
    @WithDefault("debezium-pipeline-")
    String containerNamePrefix();

    /**
     * Base directory on the remote host where pipeline configuration
     * files are stored. Each pipeline gets a subdirectory named by
     * its pipeline ID.
     */
    @WithName("config-base-path")
    @WithDefault("/opt/debezium/configs")
    String configBasePath();

    /**
     * Docker image for the Debezium Server container.
     * Defaults to the same image the provisioning playbook pre-pulls
     * (see {@code ansible/host-setup.yml}, task "Pre-pull Debezium Server Docker image").
     */
    @WithName("debezium-server-image")
    @WithDefault("quay.io/debezium/server:latest")
    String debeziumServerImage();

    /**
     * Base directory on the remote host where pipeline offset and
     * schema history data files are stored. Each pipeline gets a
     * subdirectory named by its container name.
     *
     * <p>This directory is bind-mounted into the container as
     * {@code /debezium/data}, enabling file-based offset storage
     * to survive container restarts and redeployments.
     */
    @WithName("data-base-path")
    @WithDefault("/opt/debezium/data")
    String dataBasePath();

    /**
     * Interval between status poll cycles for deployed containers.
     * Accepts Quarkus duration format, e.g. {@code 30s}, {@code 1m}.
     */
    @WithName("status-poll-interval")
    @WithDefault("30s")
    String statusPollInterval();
}
