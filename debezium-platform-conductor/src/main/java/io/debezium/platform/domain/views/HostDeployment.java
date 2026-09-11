/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.time.Instant;

import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.Mapping;
import com.blazebit.persistence.view.UpdatableEntityView;

import io.debezium.platform.data.model.DeploymentStatus;
import io.debezium.platform.data.model.HostDeploymentEntity;
import io.debezium.platform.domain.views.refs.HostDeploymentReference;

@EntityView(HostDeploymentEntity.class)
@UpdatableEntityView
public interface HostDeployment extends HostDeploymentReference {

    @Mapping("pipeline.id")
    Long getPipelineId();

    @Mapping("hostStatus.sshAlias")
    String getSshAlias();

    @Mapping("hostStatus.hostname")
    String getHostname();

    @Mapping("hostStatus.agentPort")
    int getAgentPort();

    @Mapping("hostStatus.agentToken")
    String getAgentToken();

    DeploymentStatus getDeploymentStatus();

    void setDeploymentStatus(DeploymentStatus status);

    String getConfigHash();

    Instant getDeployedAt();

    void setDeployedAt(Instant deployedAt);

    String getImageVersion();

    int getServerPort();
}
