/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

import io.debezium.platform.config.PipelineConfigGroup;
import io.debezium.platform.domain.HostAllocation;
import io.debezium.platform.domain.HostDeploymentService;
import io.debezium.platform.domain.views.HostDeployment;
import io.debezium.platform.environment.host.agent.HostAgentClient;
import io.quarkus.arc.lookup.LookupIfProperty;

/**
 * Agent-based implementation of {@link HostContainerRuntime}.
 *
 * <p>Replaces {@link AnsibleContainerRuntime} by delegating container
 * lifecycle operations to the remote Host Agent via REST calls. The
 * Agent runs on each provisioned host and translates HTTP requests
 * into Docker CLI commands locally.
 *
 * <p>Selected when {@code pipeline.host.container-runtime=agent}. The
 * controller resolves the implementation through {@code Instance.get()}, so
 * the property controls the runtime without making the two implementations
 * ambiguous CDI injection candidates.
 *
 * <p>Each lifecycle method resolves the Agent endpoint details from the
 * persisted deployment record via {@link HostDeploymentService}. This avoids
 * treating an SSH alias as an Agent hostname or silently using an empty token.
 *
 * @see HostContainerRuntime
 * @see AnsibleContainerRuntime
 * @see HostAgentClient
 *
 * @author Divyanshu Kumar Nayak
 */
@ApplicationScoped
@LookupIfProperty(name = PipelineConfigGroup.HOST_CONTAINER_RUNTIME_PROPERTY, stringValue = PipelineConfigGroup.AGENT_RUNTIME)
public class AgentContainerRuntime implements HostContainerRuntime {

    private final Logger logger;
    private final HostAgentClient agentClient;
    private final HostDeploymentService deploymentService;

    public AgentContainerRuntime(Logger logger,
                                 HostAgentClient agentClient,
                                 HostDeploymentService deploymentService) {
        this.logger = logger;
        this.agentClient = agentClient;
        this.deploymentService = deploymentService;
    }

    @Override
    public void deploy(HostAllocation allocation, String containerName,
                       String configContent, String image) {
        int port = allocation.allocatedPort();

        HostDeployment deployment = deploymentService.findByContainerName(containerName)
                .orElseThrow(() -> new IllegalStateException(
                        "No deployment found for container " + containerName + " before Agent deploy"));

        agentClient.deploy(deployment.getHostname(), deployment.getAgentPort(), deployment.getAgentToken(),
                containerName, image, port, configContent);

        logger.infov("Deploy request sent to Agent on {0} for container {1}, port {2}",
                deployment.getSshAlias(), containerName, port);
    }

    @Override
    public void undeploy(String host, String containerName) {
        HostDeployment deployment = requireDeployment(containerName, host);
        agentClient.undeploy(deployment.getHostname(), deployment.getAgentPort(),
                deployment.getAgentToken(), containerName);
    }

    @Override
    public void stop(String host, String containerName) {
        HostDeployment deployment = requireDeployment(containerName, host);
        agentClient.stop(deployment.getHostname(), deployment.getAgentPort(),
                deployment.getAgentToken(), containerName);
    }

    @Override
    public void start(String host, String containerName) {
        HostDeployment deployment = requireDeployment(containerName, host);
        agentClient.start(deployment.getHostname(), deployment.getAgentPort(),
                deployment.getAgentToken(), containerName);
    }

    @Override
    public String logs(String host, String containerName) {
        HostDeployment deployment = requireDeployment(containerName, host);
        return agentClient.logs(deployment.getHostname(), deployment.getAgentPort(),
                deployment.getAgentToken(), containerName);
    }

    private HostDeployment requireDeployment(String containerName, String host) {
        return deploymentService.findByContainerName(containerName)
                .orElseThrow(() -> new IllegalStateException(
                        "No deployment found for container " + containerName + " on " + host));
    }
}
