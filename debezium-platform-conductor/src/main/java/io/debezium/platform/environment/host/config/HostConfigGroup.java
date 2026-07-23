/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.config;

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
 *   platform.host.ansible-playbook-path=/opt/debezium/ansible/host-setup.yml
 *   platform.host.ansible-teardown-path=/opt/debezium/ansible/host-teardown.yml
 *   platform.host.ansible-timeout-minutes=30
 *   platform.host.executor-pool-size=4
 *   platform.host.shutdown-timeout-seconds=5
 * </pre>
 */
@ConfigMapping(prefix = "platform.host")
@ConfigRoot(phase = ConfigPhase.RUN_TIME)
public interface HostConfigGroup {

    @WithName("ssh-config-path")
    @WithDefault("~/.ssh/config")
    String sshConfigPath();

    @WithName("ansible-playbook-path")
    @WithDefault("/opt/debezium/ansible/host-setup.yml")
    String ansiblePlaybookPath();

    @WithName("ansible-teardown-path")
    @WithDefault("/opt/debezium/ansible/host-teardown.yml")
    String ansibleTeardownPath();

    @WithName("ansible-timeout-minutes")
    @WithDefault("30")
    int ansibleTimeoutMinutes();

    @WithName("executor-pool-size")
    @WithDefault("4")
    int executorPoolSize();

    @WithName("shutdown-timeout-seconds")
    @WithDefault("5")
    long shutdownTimeoutSeconds();
}
