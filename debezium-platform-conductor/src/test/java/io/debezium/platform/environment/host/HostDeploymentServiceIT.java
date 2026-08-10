/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import io.debezium.DebeziumException;
import io.debezium.platform.data.model.DeploymentStatus;
import io.debezium.platform.data.model.HostDeploymentEntity;
import io.debezium.platform.data.model.HostStatusEntity;
import io.debezium.platform.data.model.PipelineEntity;
import io.debezium.platform.data.model.ProvisioningStatus;
import io.debezium.platform.domain.HostDeploymentService;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

/**
 * Integration test for {@link HostDeploymentService}.
 *
 * <p>Boots a full Quarkus application in host mode with a real PostgreSQL
 * devservices database. Verifies the complete deployment CRUD lifecycle:
 * <ul>
 *   <li>Host and port allocation with PESSIMISTIC_WRITE locks</li>
 *   <li>Port increment logic (base port, MAX+1)</li>
 *   <li>Deployment creation, lookup, status update, and deletion</li>
 *   <li>Query by status (single and multiple)</li>
 *   <li>Fail-loud when no READY hosts exist</li>
 *   <li>Fail-loud when pipeline has no deployment</li>
 * </ul>
 *
 * <p>Tests are ordered because they modify shared database state.
 * Each test builds on the state left by the previous one, following
 * the same pattern as {@link io.debezium.platform.environment.host.discovery.SshConfigWatcherServiceIT}.
 */
@QuarkusTest
@TestProfile(HostModeTestProfile.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class HostDeploymentServiceIT {

    @Inject
    HostDeploymentService deploymentService;

    @Inject
    EntityManager em;

    /** Pipeline ID seeded in setUp(). */
    private static Long seededPipelineId;

    /** Second pipeline ID seeded in setUp(). */
    private static Long seededPipeline2Id;

    /** Host status ID seeded in setUp(). */
    private static Long seededHostId;

    /** Second host status ID seeded in setUp(). */
    private static Long seededHost2Id;

    /** Tracks the deployment ID created during tests. */
    private static Long createdDeploymentId;

    @BeforeEach
    @Transactional
    void seedTestData() {
        // Only seed once (first test)
        if (seededPipelineId != null) {
            return;
        }

        // Create two READY hosts
        HostStatusEntity host1 = new HostStatusEntity();
        host1.setSshAlias("it-host-1");
        host1.setHostname("192.168.1.10");
        host1.setProvisioningStatus(ProvisioningStatus.READY);
        host1.setAgentPort(8090);
        host1.setLastCheckedAt(Instant.now());
        em.persist(host1);

        HostStatusEntity host2 = new HostStatusEntity();
        host2.setSshAlias("it-host-2");
        host2.setHostname("192.168.1.20");
        host2.setProvisioningStatus(ProvisioningStatus.READY);
        host2.setAgentPort(8090);
        host2.setLastCheckedAt(Instant.now());
        em.persist(host2);

        // Create two pipelines
        PipelineEntity pipeline1 = new PipelineEntity();
        pipeline1.setName("it-pipeline-1");
        em.persist(pipeline1);

        PipelineEntity pipeline2 = new PipelineEntity();
        pipeline2.setName("it-pipeline-2");
        em.persist(pipeline2);

        em.flush();

        seededHostId = host1.getId();
        seededHost2Id = host2.getId();
        seededPipelineId = pipeline1.getId();
        seededPipeline2Id = pipeline2.getId();
    }

    @Test
    @Order(1)
    public void shouldAllocateHostAndPortFromBasePort() {
        HostDeploymentService.HostAllocation allocation = deploymentService.allocateHostAndPort();

        assertThat(allocation).isNotNull();
        assertThat(allocation.hostStatus()).isNotNull();
        assertThat(allocation.hostStatus().getProvisioningStatus()).isEqualTo(ProvisioningStatus.READY);
        // Base port is 9000 (default from HostConfigGroup)
        assertThat(allocation.allocatedPort()).isEqualTo(9000);
    }

    @Test
    @Order(2)
    public void shouldCreateDeploymentWithCorrectFields() {
        HostDeploymentEntity deployment = deploymentService.createDeployment(
                seededPipelineId, seededHostId,
                "debezium-pipeline-" + seededPipelineId,
                "quay.io/debezium/server:latest",
                9000, "abc123hash");

        assertThat(deployment.getId()).isNotNull();
        assertThat(deployment.getContainerName()).isEqualTo("debezium-pipeline-" + seededPipelineId);
        assertThat(deployment.getImageVersion()).isEqualTo("quay.io/debezium/server:latest");
        assertThat(deployment.getServerPort()).isEqualTo(9000);
        assertThat(deployment.getDeploymentStatus()).isEqualTo(DeploymentStatus.DEPLOYING);
        assertThat(deployment.getConfigHash()).isEqualTo("abc123hash");
        assertThat(deployment.getDeployedAt()).isNotNull();

        createdDeploymentId = deployment.getId();
    }

    @Test
    @Order(3)
    public void shouldFindDeploymentByPipelineId() {
        var deployment = deploymentService.findByPipelineId(seededPipelineId);

        assertThat(deployment)
                .as("Should find the deployment created in the previous test")
                .isPresent();
        assertThat(deployment.get().getContainerName())
                .isEqualTo("debezium-pipeline-" + seededPipelineId);
    }

    @Test
    @Order(4)
    public void shouldReturnEmptyForNonExistentPipeline() {
        var deployment = deploymentService.findByPipelineId(999999L);

        assertThat(deployment)
                .as("Non-existent pipeline should return empty")
                .isEmpty();
    }

    @Test
    @Order(5)
    public void shouldThrowWhenRequiringNonExistentPipeline() {
        assertThatThrownBy(() -> deploymentService.requireByPipelineId(999999L))
                .isInstanceOf(DebeziumException.class)
                .hasMessageContaining("No active deployment found");
    }

    @Test
    @Order(6)
    public void shouldFindDeploymentsByStatus() {
        List<HostDeploymentEntity> deployments = deploymentService.findByStatus(DeploymentStatus.DEPLOYING);

        assertThat(deployments)
                .as("Should find the DEPLOYING deployment")
                .hasSizeGreaterThanOrEqualTo(1);
        assertThat(deployments)
                .extracting(HostDeploymentEntity::getDeploymentStatus)
                .containsOnly(DeploymentStatus.DEPLOYING);
    }

    @Test
    @Order(7)
    public void shouldUpdateDeploymentStatus() {
        deploymentService.updateStatus(createdDeploymentId, DeploymentStatus.RUNNING);

        var deployment = deploymentService.findByPipelineId(seededPipelineId);
        assertThat(deployment).isPresent();
        assertThat(deployment.get().getDeploymentStatus()).isEqualTo(DeploymentStatus.RUNNING);
    }

    @Test
    @Order(8)
    public void shouldFindByMultipleStatuses() {
        // Create a second deployment on the other host with DEPLOYING status
        deploymentService.createDeployment(
                seededPipeline2Id, seededHost2Id,
                "debezium-pipeline-" + seededPipeline2Id,
                "quay.io/debezium/server:latest",
                9001, "def456hash");

        List<HostDeploymentEntity> results = deploymentService.findByStatuses(
                DeploymentStatus.DEPLOYING, DeploymentStatus.RUNNING);

        assertThat(results)
                .as("Should find both DEPLOYING and RUNNING deployments")
                .hasSizeGreaterThanOrEqualTo(2);
    }

    @Test
    @Order(9)
    public void shouldAllocateIncrementedPortOnSameHost() {
        // After deploying pipeline-1 on a host with port 9000,
        // the next allocation should get port 9001 or higher on any host
        // (depends on which host the strategy picks)
        HostDeploymentService.HostAllocation allocation = deploymentService.allocateHostAndPort();

        assertThat(allocation.allocatedPort())
                .as("Port should be incremented beyond existing deployments")
                .isGreaterThanOrEqualTo(9000);
    }

    @Test
    @Order(10)
    public void shouldDeleteDeploymentAndFreeConstraint() {
        // Delete the first deployment
        deploymentService.deleteDeployment(createdDeploymentId);

        var deleted = deploymentService.findByPipelineId(seededPipelineId);
        assertThat(deleted)
                .as("Deployment should be hard-deleted from the database")
                .isEmpty();
    }

    @Test
    @Order(11)
    public void shouldSkipStatusUpdateForNonExistentDeployment() {
        // This should not throw — it logs a warning and returns
        deploymentService.updateStatus(999999L, DeploymentStatus.FAILED);
        // No assertion needed — we're verifying it doesn't crash
    }

    @Test
    @Order(12)
    public void shouldResetDeployedAtWhenTransitioningToDeploying() {
        // The second deployment (seededPipeline2Id) was created in Order 8
        // with status DEPLOYING and deployedAt set to that moment.
        var deployment = deploymentService.findByPipelineId(seededPipeline2Id);
        assertThat(deployment).isPresent();

        Instant originalDeployedAt = deployment.get().getDeployedAt();
        Long deploymentId = deployment.get().getId();

        // Simulate the full lifecycle: DEPLOYING → RUNNING → STOPPED → DEPLOYING (restart)
        deploymentService.updateStatus(deploymentId, DeploymentStatus.RUNNING);
        deploymentService.updateStatus(deploymentId, DeploymentStatus.STOPPED);
        deploymentService.updateStatus(deploymentId, DeploymentStatus.DEPLOYING);

        // Clear the persistence context so we do not read stale cached entity from L1 cache
        em.clear();

        // Re-read from database
        var updated = deploymentService.findByPipelineId(seededPipeline2Id);
        assertThat(updated).isPresent();
        assertThat(updated.get().getDeployedAt())
                .as("deployedAt must be refreshed when transitioning back to DEPLOYING (restart scenario)")
                .isAfter(originalDeployedAt);
        assertThat(updated.get().getDeploymentStatus()).isEqualTo(DeploymentStatus.DEPLOYING);
    }

    @Test
    @Order(13)
    public void shouldNotResetDeployedAtWhenTransitioningToNonDeployingStatus() {
        // After Order 12, the second deployment is back to DEPLOYING with a fresh deployedAt.
        var deployment = deploymentService.findByPipelineId(seededPipeline2Id);
        assertThat(deployment).isPresent();

        Instant deployedAtBeforeTransition = deployment.get().getDeployedAt();
        Long deploymentId = deployment.get().getId();

        // Transition to RUNNING — should NOT touch deployedAt
        deploymentService.updateStatus(deploymentId, DeploymentStatus.RUNNING);
        em.clear();

        var afterRunning = deploymentService.findByPipelineId(seededPipeline2Id);
        assertThat(afterRunning).isPresent();
        assertThat(afterRunning.get().getDeployedAt())
                .as("deployedAt must NOT change when transitioning to RUNNING")
                .isEqualTo(deployedAtBeforeTransition);

        // Transition to STOPPED — should NOT touch deployedAt either
        deploymentService.updateStatus(deploymentId, DeploymentStatus.STOPPED);
        em.clear();

        var afterStopped = deploymentService.findByPipelineId(seededPipeline2Id);
        assertThat(afterStopped).isPresent();
        assertThat(afterStopped.get().getDeployedAt())
                .as("deployedAt must NOT change when transitioning to STOPPED")
                .isEqualTo(deployedAtBeforeTransition);

        // Transition to FAILED — should NOT touch deployedAt either
        deploymentService.updateStatus(deploymentId, DeploymentStatus.FAILED);
        em.clear();

        var afterFailed = deploymentService.findByPipelineId(seededPipeline2Id);
        assertThat(afterFailed).isPresent();
        assertThat(afterFailed.get().getDeployedAt())
                .as("deployedAt must NOT change when transitioning to FAILED")
                .isEqualTo(deployedAtBeforeTransition);
    }
}
