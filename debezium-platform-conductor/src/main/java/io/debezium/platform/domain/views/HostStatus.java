/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.time.Instant;

import com.blazebit.persistence.view.CreatableEntityView;
import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.UpdatableEntityView;

import io.debezium.platform.data.model.HostStatusEntity;
import io.debezium.platform.data.model.ProvisioningStatus;
import io.debezium.platform.domain.views.refs.HostStatusReference;

@EntityView(HostStatusEntity.class)
@CreatableEntityView
@UpdatableEntityView
public interface HostStatus extends HostStatusReference {

    String getHostname();

    void setHostname(String hostname);

    void setSshAlias(String sshAlias);

    ProvisioningStatus getProvisioningStatus();

    void setProvisioningStatus(ProvisioningStatus status);

    int getAgentPort();

    void setAgentPort(int port);

    String getAgentToken();

    void setAgentToken(String token);

    Instant getLastCheckedAt();

    void setLastCheckedAt(Instant lastCheckedAt);
}
