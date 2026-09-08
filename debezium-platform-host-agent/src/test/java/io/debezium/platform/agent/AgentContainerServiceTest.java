/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.file.Files;
import java.nio.file.Path;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

/** Unit tests for the local Agent container lifecycle service. */
class AgentContainerServiceTest {

    @Test
    void undeployStopsBeforeRemovingTheContainer(@TempDir Path tempDir) {
        DockerCommandRunner commandRunner = mock(DockerCommandRunner.class);
        when(commandRunner.run(any())).thenReturn(new DockerCommandRunner.CommandOutput(0, ""));

        AgentContainerService service = new AgentContainerService(Logger.getLogger(AgentContainerServiceTest.class),
                commandRunner, config(tempDir));

        service.undeploy("pipeline-1");

        ArgumentCaptor<HostCommand> commands = ArgumentCaptor.forClass(HostCommand.class);
        org.mockito.Mockito.verify(commandRunner, org.mockito.Mockito.times(2)).run(commands.capture());
        assertEquals(java.util.List.of("docker", "stop", "pipeline-1"), commands.getAllValues().get(0).arguments());
        assertEquals(java.util.List.of("docker", "rm", "-f", "pipeline-1"), commands.getAllValues().get(1).arguments());
    }

    @Test
    void computeConfigHashIsEmptyWhenConfigurationDoesNotExist(@TempDir Path tempDir) {
        AgentContainerService service = new AgentContainerService(Logger.getLogger(AgentContainerServiceTest.class),
                mock(DockerCommandRunner.class), config(tempDir));

        assertTrue(service.computeConfigHash("pipeline-1").isEmpty());
    }

    @Test
    void statusTreatsOnlyDockerMissingContainerOutputAsNotFound(@TempDir Path tempDir) {
        DockerCommandRunner commandRunner = mock(DockerCommandRunner.class);
        when(commandRunner.run(any())).thenReturn(
                new DockerCommandRunner.CommandOutput(1, "Error: No such object: pipeline-1"));
        AgentContainerService service = new AgentContainerService(Logger.getLogger(AgentContainerServiceTest.class),
                commandRunner, config(tempDir));

        assertTrue(service.status("pipeline-1").isEmpty());
    }

    @Test
    void computeConfigHashUsesTheConfigurationContent(@TempDir Path tempDir) throws Exception {
        Path configuration = tempDir.resolve("configs").resolve("pipeline-1");
        Files.createDirectories(configuration);
        Files.writeString(configuration.resolve("application.properties"), "debezium.sink.type=kafka");

        AgentContainerService service = new AgentContainerService(Logger.getLogger(AgentContainerServiceTest.class),
                mock(DockerCommandRunner.class), config(tempDir));

        assertEquals("1a910bf2bd6f1f107a87ae4cd91b17c1979628b7e626d85dde2209e82c052e8e",
                service.computeConfigHash("pipeline-1").orElseThrow());
    }

    private static AgentConfig config(Path tempDir) {
        AgentConfig config = mock(AgentConfig.class);
        when(config.configBasePath()).thenReturn(tempDir.resolve("configs").toString());
        when(config.dataBasePath()).thenReturn(tempDir.resolve("data").toString());
        return config;
    }
}
