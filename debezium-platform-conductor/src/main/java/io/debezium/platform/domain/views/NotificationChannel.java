/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.time.Instant;
import java.util.Map;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import com.blazebit.persistence.view.CreatableEntityView;
import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.MappingSingular;
import com.blazebit.persistence.view.UpdatableEntityView;

import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.NotificationChannelEntity;
import io.debezium.platform.domain.views.base.NamedView;

@EntityView(NotificationChannelEntity.class)
@CreatableEntityView
@UpdatableEntityView
public interface NotificationChannel extends NamedView {

    @Override
    @NotEmpty
    String getName();

    @NotNull
    ChannelType getType();

    @MappingSingular
    Map<String, Object> getConfig();

    boolean isEnabled();

    Instant getCreatedAt();

    Instant getUpdatedAt();

    void setName(String name);

    void setType(ChannelType type);

    void setConfig(Map<String, Object> config);

    void setEnabled(boolean enabled);
}
