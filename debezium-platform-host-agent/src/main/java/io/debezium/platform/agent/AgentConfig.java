/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import java.util.Optional;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.smallrye.config.WithName;

/**
 * Configuration for the Host Agent.
 *
 * <p>Properties are mapped under the {@code agent} prefix:
 * <pre>
 *   agent.token=${AGENT_TOKEN:}          # set by systemd via Ansible provisioning
 *   agent.config-base-path=/opt/debezium/configs
 *   agent.data-base-path=/opt/debezium/data
 * </pre>
 *
 * <p>The {@code agent.token} value comes from the {@code AGENT_TOKEN} environment
 * variable, which is set in the systemd unit file during Ansible provisioning
 * (see {@code host-setup.yml}, line 173: {@code Environment="AGENT_TOKEN={{ agent_token }}"}).
 */
@ConfigMapping(prefix = "agent")
public interface AgentConfig {

    /**
     * Bearer token used to authenticate incoming requests.
     * Generated per-host during Ansible provisioning and stored
     * in {@code HostStatusEntity.agentToken} on the Conductor side.
     */
    @WithName("token")
    Optional<String> token();

    /**
     * Base directory where pipeline configuration files are stored.
     * Each pipeline gets a subdirectory named by its container name.
     * Matches the Conductor's {@code platform.host.config-base-path} default.
     */
    @WithName("config-base-path")
    @WithDefault("/opt/debezium/configs")
    String configBasePath();

    /**
     * Base directory where pipeline offset and schema history data files
     * are stored. Each pipeline gets a subdirectory named by its container
     * name. Matches the Conductor's {@code platform.host.data-base-path} default.
     */
    @WithName("data-base-path")
    @WithDefault("/opt/debezium/data")
    String dataBasePath();
}
