/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.time.Instant;

import io.debezium.platform.data.model.DeploymentStatus;
import io.debezium.platform.data.model.HostDeploymentEntity;

/**
 * Lightweight domain representation of a host deployment.
 *
 * <p>Contains only the fields that callers outside the persistence layer
 * need. This prevents JPA entity details (lazy associations to
 * {@code PipelineEntity} and {@code HostStatusEntity}, Hibernate proxies)
 * from leaking into controller and poller layers.
 *
 * @see HostDeploymentEntity
 */
public record Deployment(Long id, Long pipelineId, String containerName,
        String sshAlias, DeploymentStatus status,
        String configHash, Instant deployedAt) {

    /**
     * Maps a JPA entity to its domain representation.
     */
    public static Deployment from(HostDeploymentEntity entity) {
        return new Deployment(
                entity.getId(),
                entity.getPipeline().getId(),
                entity.getContainerName(),
                entity.getHostStatus().getSshAlias(),
                entity.getDeploymentStatus(),
                entity.getConfigHash(),
                entity.getDeployedAt());
    }
}
