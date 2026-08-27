/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

import io.debezium.platform.domain.HostDeploymentService;
import io.debezium.platform.domain.views.HostDeployment;
import io.debezium.platform.environment.logs.LogReader;

/**
 * {@link LogReader} implementation that reads Docker container logs
 * via the {@link HostContainerRuntime}.
 */
class HostDockerLogReader implements LogReader {

    private final Long pipelineId;
    private final HostDeploymentService deploymentService;
    private final HostContainerRuntime containerRuntime;
    private BufferedReader reader;

    HostDockerLogReader(Long pipelineId,
                        HostDeploymentService deploymentService,
                        HostContainerRuntime containerRuntime) {
        this.pipelineId = pipelineId;
        this.deploymentService = deploymentService;
        this.containerRuntime = containerRuntime;
    }

    @Override
    public String readAll() {
        HostDeployment deployment = deploymentService.requireByPipelineId(pipelineId);
        String sshAlias = deployment.getSshAlias();
        String containerName = deployment.getContainerName();
        return containerRuntime.logs(sshAlias, containerName);
    }

    @Override
    public BufferedReader reader() throws IOException {
        if (reader == null) {
            String content = readAll();
            reader = new BufferedReader(
                    new InputStreamReader(
                            new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)),
                            StandardCharsets.UTF_8));
        }
        return reader;
    }

    @Override
    public String readLine() throws IOException {
        return reader().readLine();
    }

    @Override
    public void close() throws IOException {
        if (reader != null) {
            reader.close();
        }
    }
}
