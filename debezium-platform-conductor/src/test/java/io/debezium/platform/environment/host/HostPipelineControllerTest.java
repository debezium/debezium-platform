/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.debezium.DebeziumException;
import io.debezium.platform.data.model.DeploymentStatus;
import io.debezium.platform.data.model.HostDeploymentEntity;
import io.debezium.platform.data.model.HostStatusEntity;
import io.debezium.platform.domain.HostDeploymentService;
import io.debezium.platform.domain.Signal;
import io.debezium.platform.domain.views.flat.DestinationFlat;
import io.debezium.platform.domain.views.flat.PipelineFlat;
import io.debezium.platform.domain.views.flat.SourceFlat;
import io.debezium.platform.environment.host.config.HostConfigGroup;

/**
 * Unit tests for {@link HostPipelineController}.
 *
 * <p>Plain JUnit 5 tests with no {@code @QuarkusTest}. All dependencies
 * are mocked. Async operations are synchronized via {@link CountDownLatch}
 * — the same pattern used by {@link io.debezium.platform.environment.host.provisioning.HostProvisioningServiceTest}.
 *
 * <p>This verifies:
 * <ul>
 *   <li>Deploy calls mapper, allocates host+port, delegates to runtime</li>
 *   <li>Deploy marks FAILED if runtime deploy fails</li>
 *   <li>Undeploy delegates to runtime and deletes DB record</li>
 *   <li>Undeploy skips gracefully when no deployment exists</li>
 *   <li>Stop delegates to runtime and marks STOPPED</li>
 *   <li>Start delegates to runtime and marks DEPLOYING</li>
 *   <li>sendSignal throws UnsupportedOperationException</li>
 *   <li>All operations run on the dedicated thread pool</li>
 * </ul>
 */
class HostPipelineControllerTest {

    private static final long ASYNC_WAIT_SECONDS = 10;

    private HostPipelineMapper pipelineMapper;
    private HostDeploymentService deploymentService;
    private HostContainerRuntime containerRuntime;
    private HostPipelineController controller;

    @BeforeEach
    void setUp() {
        Logger logger = Logger.getLogger(HostPipelineControllerTest.class);
        pipelineMapper = mock(HostPipelineMapper.class);
        deploymentService = mock(HostDeploymentService.class);
        containerRuntime = mock(HostContainerRuntime.class);

        HostConfigGroup hostConfig = mock(HostConfigGroup.class);
        when(hostConfig.executorPoolSize()).thenReturn(4);
        when(hostConfig.shutdownTimeoutSeconds()).thenReturn(5L);
        when(hostConfig.debeziumServerImage()).thenReturn("quay.io/debezium/server:latest");

        when(deploymentService.findByPipelineId(anyLong())).thenReturn(Optional.empty());

        controller = new HostPipelineController(logger, pipelineMapper, deploymentService, containerRuntime, hostConfig);
    }

    @AfterEach
    void tearDown() {
        controller.onStop(null);
    }

    @Test
    void deployCallsMapperAndDelegatesToRuntime() throws Exception {
        PipelineFlat pipeline = buildMinimalPipeline(1L);

        when(pipelineMapper.map(pipeline)).thenReturn(
                new HostPipelineMapper.MappedConfig("debezium.source.connector.class=test", "hash123"));

        HostStatusEntity host = new HostStatusEntity();
        host.setId(10L);
        host.setSshAlias("test-host");
        when(deploymentService.allocateHostAndPort()).thenReturn(
                new HostDeploymentService.HostAllocation(host, 9000));

        HostDeploymentEntity deploymentEntity = new HostDeploymentEntity();
        deploymentEntity.setId(100L);
        when(deploymentService.createDeployment(anyLong(), anyLong(), anyString(), anyString(), anyInt(), anyString()))
                .thenReturn(deploymentEntity);

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        }).when(containerRuntime).deploy(anyString(), anyString(), anyInt(), anyString(), anyString());

        controller.deploy(pipeline);

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(pipelineMapper).map(pipeline);
        verify(deploymentService).allocateHostAndPort();
        // Container name now uses pipeline name, not ID
        verify(deploymentService).createDeployment(eq(1L), eq(10L), eq("test-pipeline-1"), anyString(), eq(9000), eq("hash123"));
        verify(containerRuntime).deploy(eq("test-host"), eq("test-pipeline-1"), eq(9000), anyString(), anyString());
    }

    @Test
    void deployMarksFailedWhenRuntimeDeployFails() throws Exception {
        PipelineFlat pipeline = buildMinimalPipeline(2L);

        when(pipelineMapper.map(pipeline)).thenReturn(
                new HostPipelineMapper.MappedConfig("content", "hash456"));

        HostStatusEntity host = new HostStatusEntity();
        host.setId(10L);
        host.setSshAlias("test-host");
        when(deploymentService.allocateHostAndPort()).thenReturn(
                new HostDeploymentService.HostAllocation(host, 9001));

        HostDeploymentEntity deploymentEntity = new HostDeploymentEntity();
        deploymentEntity.setId(101L);
        when(deploymentService.createDeployment(anyLong(), anyLong(), anyString(), anyString(), anyInt(), anyString()))
                .thenReturn(deploymentEntity);

        // Runtime deploy throws
        CountDownLatch latch = new CountDownLatch(1);
        doThrow(new DebeziumException("Failed to create config directory"))
                .when(containerRuntime).deploy(anyString(), anyString(), anyInt(), anyString(), anyString());

        when(deploymentService.findByPipelineId(2L)).thenReturn(Optional.of(deploymentEntity));
        doAnswer(inv -> {
            latch.countDown();
            return null;
        }).when(deploymentService).updateStatus(eq(101L), eq(DeploymentStatus.FAILED));

        controller.deploy(pipeline);

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(deploymentService).updateStatus(101L, DeploymentStatus.FAILED);
    }

    @Test
    void undeployDelegatesToRuntimeAndDeletesRecord() throws Exception {
        HostDeploymentEntity deployment = createMockDeployment(200L, "my-pipeline", "host-1");
        when(deploymentService.findByPipelineId(5L)).thenReturn(Optional.of(deployment));

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        }).when(deploymentService).deleteDeployment(200L);

        controller.undeploy(5L);

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(containerRuntime).undeploy("host-1", "my-pipeline");
        verify(deploymentService).deleteDeployment(200L);
    }

    @Test
    void undeploySkipsGracefullyWhenNoDeploymentExists() throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        when(deploymentService.findByPipelineId(999L)).thenAnswer(inv -> {
            latch.countDown();
            return Optional.empty();
        });

        controller.undeploy(999L);

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(deploymentService, never()).deleteDeployment(anyLong());
        verify(containerRuntime, never()).undeploy(anyString(), anyString());
    }

    @Test
    void stopDelegatesToRuntimeAndMarksStatus() throws Exception {
        HostDeploymentEntity deployment = createMockDeployment(300L, "my-pipeline", "host-2");

        when(deploymentService.requireByPipelineId(10L)).thenReturn(deployment);

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        }).when(deploymentService).updateStatus(300L, DeploymentStatus.STOPPED);

        controller.stop(10L);

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(containerRuntime).stop("host-2", "my-pipeline");
        verify(deploymentService).updateStatus(300L, DeploymentStatus.STOPPED);
    }

    @Test
    void startDelegatesToRuntimeAndMarksDeploying() throws Exception {
        HostDeploymentEntity deployment = createMockDeployment(400L, "my-pipeline", "host-3");

        when(deploymentService.requireByPipelineId(15L)).thenReturn(deployment);

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        }).when(deploymentService).updateStatus(400L, DeploymentStatus.DEPLOYING);

        controller.start(15L);

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(containerRuntime).start("host-3", "my-pipeline");
        verify(deploymentService).updateStatus(400L, DeploymentStatus.DEPLOYING);
    }

    @Test
    void sendSignalThrowsUnsupportedOperationException() {
        Signal signal = new Signal("id", "type", "data", Map.of());

        assertThatThrownBy(() -> controller.sendSignal(1L, signal))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessageContaining("not supported in host deployment mode");
    }

    @Test
    void deployRunsOnDedicatedThreadPool() throws Exception {
        String[] executionThreadName = new String[1];
        PipelineFlat pipeline = buildMinimalPipeline(50L);

        when(pipelineMapper.map(pipeline)).thenReturn(
                new HostPipelineMapper.MappedConfig("content", "hash"));

        HostStatusEntity host = new HostStatusEntity();
        host.setId(10L);
        host.setSshAlias("test-host");
        when(deploymentService.allocateHostAndPort()).thenReturn(
                new HostDeploymentService.HostAllocation(host, 9050));

        HostDeploymentEntity deploymentEntity = new HostDeploymentEntity();
        deploymentEntity.setId(500L);
        when(deploymentService.createDeployment(anyLong(), anyLong(), anyString(), anyString(), anyInt(), anyString()))
                .thenReturn(deploymentEntity);

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            executionThreadName[0] = Thread.currentThread().getName();
            latch.countDown();
            return null;
        }).when(containerRuntime).deploy(anyString(), anyString(), anyInt(), anyString(), anyString());

        controller.deploy(pipeline);

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        assertThat(executionThreadName[0]).startsWith("debezium-");
        assertThat(executionThreadName[0]).doesNotContain("ForkJoinPool");
    }

    @Test
    void logReaderReturnsNonNull() {
        HostDeploymentEntity deployment = createMockDeployment(600L, "my-pipeline", "host-4");
        when(deploymentService.requireByPipelineId(20L)).thenReturn(deployment);

        var logReader = controller.logReader(20L);
        assertThat(logReader).isNotNull();
    }

    @Test
    void deployMarksFailedOnUnexpectedException() throws Exception {
        PipelineFlat pipeline = buildMinimalPipeline(70L);

        // Mapper throws unexpected exception
        when(pipelineMapper.map(pipeline)).thenThrow(new RuntimeException("Unexpected NullPointer"));

        CountDownLatch latch = new CountDownLatch(1);
        HostDeploymentEntity deploymentEntity = new HostDeploymentEntity();
        deploymentEntity.setId(700L);
        when(deploymentService.findByPipelineId(70L)).thenReturn(Optional.of(deploymentEntity));
        doAnswer(inv -> {
            latch.countDown();
            return null;
        }).when(deploymentService).updateStatus(eq(700L), eq(DeploymentStatus.FAILED));

        controller.deploy(pipeline);

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(deploymentService).updateStatus(700L, DeploymentStatus.FAILED);
    }

    @Test
    void stopDoesNotUpdateStatusWhenRuntimeFails() throws Exception {
        HostDeploymentEntity deployment = createMockDeployment(800L, "my-pipeline", "host-5");
        when(deploymentService.requireByPipelineId(80L)).thenReturn(deployment);

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            throw new DebeziumException("container not found");
        }).when(containerRuntime).stop(eq("host-5"), eq("my-pipeline"));

        controller.stop(80L);

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        // Status should NOT be updated to STOPPED because the exception prevents it
        verify(deploymentService, never()).updateStatus(eq(800L), eq(DeploymentStatus.STOPPED));
    }

    @Test
    void startDoesNotUpdateStatusWhenRuntimeFails() throws Exception {
        HostDeploymentEntity deployment = createMockDeployment(900L, "my-pipeline", "host-6");
        when(deploymentService.requireByPipelineId(90L)).thenReturn(deployment);

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            throw new DebeziumException("no such container");
        }).when(containerRuntime).start(eq("host-6"), eq("my-pipeline"));

        controller.start(90L);

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        // Status should NOT be updated to DEPLOYING because the exception prevents it
        verify(deploymentService, never()).updateStatus(eq(900L), eq(DeploymentStatus.DEPLOYING));
    }

    @Test
    void deployCleansUpExistingDeploymentBeforeRedeploy() throws Exception {
        PipelineFlat pipeline = buildMinimalPipeline(1L);

        HostDeploymentEntity existingDeployment = createMockDeployment(99L, "test-pipeline-1", "host-1");
        existingDeployment.setDeploymentStatus(DeploymentStatus.FAILED);
        when(deploymentService.findByPipelineId(1L)).thenReturn(Optional.of(existingDeployment));

        when(pipelineMapper.map(pipeline)).thenReturn(
                new HostPipelineMapper.MappedConfig("key=value", "hash123"));

        HostStatusEntity host = new HostStatusEntity();
        host.setId(10L);
        host.setSshAlias("host-1");
        when(deploymentService.allocateHostAndPort()).thenReturn(
                new HostDeploymentService.HostAllocation(host, 9000));

        CountDownLatch latch = new CountDownLatch(1);
        when(deploymentService.createDeployment(eq(1L), eq(10L), eq("test-pipeline-1"), anyString(), eq(9000), eq("hash123")))
                .thenAnswer(inv -> {
                    latch.countDown();
                    return createMockDeployment(100L, "test-pipeline-1", "host-1");
                });

        controller.deploy(pipeline);

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(containerRuntime).undeploy("host-1", "test-pipeline-1");
        verify(deploymentService).deleteDeployment(99L);
        verify(deploymentService).createDeployment(eq(1L), eq(10L), eq("test-pipeline-1"), anyString(), eq(9000), eq("hash123"));
    }

    // ── Helpers ──

    private PipelineFlat buildMinimalPipeline(Long id) {
        SourceFlat source = mock(SourceFlat.class);
        when(source.getType()).thenReturn("io.debezium.connector.postgresql.PostgresConnector");
        when(source.getConnection()).thenReturn(null);
        when(source.getConfig()).thenReturn(Collections.emptyMap());

        DestinationFlat destination = mock(DestinationFlat.class);
        when(destination.getType()).thenReturn("io.debezium.server.kafka.KafkaChangeConsumer");
        when(destination.getConnection()).thenReturn(null);
        when(destination.getConfig()).thenReturn(Collections.emptyMap());

        PipelineFlat pipeline = mock(PipelineFlat.class);
        when(pipeline.getId()).thenReturn(id);
        when(pipeline.getName()).thenReturn("test-pipeline-" + id);
        when(pipeline.getSource()).thenReturn(source);
        when(pipeline.getDestination()).thenReturn(destination);
        when(pipeline.getTransforms()).thenReturn(List.of());
        when(pipeline.getDefaultLogLevel()).thenReturn("INFO");
        when(pipeline.getLogLevels()).thenReturn(Collections.emptyMap());

        return pipeline;
    }

    private HostDeploymentEntity createMockDeployment(Long deploymentId, String containerName, String sshAlias) {
        HostStatusEntity host = new HostStatusEntity();
        host.setSshAlias(sshAlias);

        HostDeploymentEntity deployment = new HostDeploymentEntity();
        deployment.setId(deploymentId);
        deployment.setContainerName(containerName);
        deployment.setHostStatus(host);

        return deployment;
    }
}
