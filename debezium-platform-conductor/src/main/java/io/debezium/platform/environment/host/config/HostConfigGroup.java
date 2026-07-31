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
    @WithDefault("5m")
    String reconciliationInterval();
}
