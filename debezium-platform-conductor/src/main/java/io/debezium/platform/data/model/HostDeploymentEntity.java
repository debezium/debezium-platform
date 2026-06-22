/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

/**
 * Links a pipeline to a specific host deployment (one active deployment per pipeline).
 *
 * <p>The {@code pipeline_id} FK has a UNIQUE constraint enforced at the database level to
 * guarantee that a pipeline can only have one active deployment at any time. This prevents
 * double-deploy bugs even under concurrent requests.</p>
 *
 * <p><strong>Hard delete on undeploy.</strong> When a pipeline is undeployed, the row is
 * physically deleted — not soft-deleted. This is intentional: it frees the {@code pipeline_id}
 * UNIQUE constraint for re-deployment and allows the {@code serverPort} to be reclaimed by
 * new deployments on the same host.</p>
 */
@Entity(name = "host_deployment")
public class HostDeploymentEntity {

    @Id
    @GeneratedValue
    private Long id;

    @ManyToOne
    @JoinColumn(name = "pipeline_id", unique = true, nullable = false)
    private PipelineEntity pipeline;

    @ManyToOne
    @JoinColumn(name = "host_status_id", nullable = false)
    private HostStatusEntity hostStatus;

    @Column(nullable = false)
    private String containerName;

    @Column(nullable = false)
    private String imageVersion;

    @Column(nullable = false)
    private int serverPort;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DeploymentStatus deploymentStatus;

    @Column(nullable = false)
    private String configHash;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public PipelineEntity getPipeline() {
        return pipeline;
    }

    public void setPipeline(PipelineEntity pipeline) {
        this.pipeline = pipeline;
    }

    public HostStatusEntity getHostStatus() {
        return hostStatus;
    }

    public void setHostStatus(HostStatusEntity hostStatus) {
        this.hostStatus = hostStatus;
    }

    public String getContainerName() {
        return containerName;
    }

    public void setContainerName(String containerName) {
        this.containerName = containerName;
    }

    public String getImageVersion() {
        return imageVersion;
    }

    public void setImageVersion(String imageVersion) {
        this.imageVersion = imageVersion;
    }

    public int getServerPort() {
        return serverPort;
    }

    public void setServerPort(int serverPort) {
        this.serverPort = serverPort;
    }

    public DeploymentStatus getDeploymentStatus() {
        return deploymentStatus;
    }

    public void setDeploymentStatus(DeploymentStatus deploymentStatus) {
        this.deploymentStatus = deploymentStatus;
    }

    public String getConfigHash() {
        return configHash;
    }

    public void setConfigHash(String configHash) {
        this.configHash = configHash;
    }
}
