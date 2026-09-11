/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import java.util.Map;

import io.quarkus.runtime.annotations.ConfigPhase;
import io.quarkus.runtime.annotations.ConfigRoot;
import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.smallrye.config.WithName;

@ConfigMapping(prefix = "pipeline")
@ConfigRoot(phase = ConfigPhase.RUN_TIME)
public interface PipelineConfigGroup {

    String DEPLOYMENT_MODE_PROPERTY = "pipeline.deployment.mode";
    String HOST_CONTAINER_RUNTIME_PROPERTY = "pipeline.host.container-runtime";
    String AGENT_RUNTIME = "agent";
    String ANSIBLE_RUNTIME = "ansible";

    @WithName("deployment.mode")
    @WithDefault("operator")
    String deploymentMode();

    HostConfig host();

    OffsetConfigGroup offset();

    @WithName("schema.history")
    SchemaHistoryConfigGroup schema();

    ServerConfigGroup server();

    Map<String, String> labels();

    MonitoringConfigGroup monitoring();

    HealthProbesConfigGroup health();

    interface HostConfig {

        @WithName("container-runtime")
        @WithDefault(ANSIBLE_RUNTIME)
        String containerRuntime();
    }
}
