/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.util.Map;

import com.blazebit.persistence.view.CreatableEntityView;
import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.MappingSingular;
import com.blazebit.persistence.view.UpdatableEntityView;

import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.base.NamedView;

@EntityView(ConnectionEntity.class)
@CreatableEntityView
@UpdatableEntityView
public interface Connection extends NamedView {

    void setName(String name);

    ConnectionEntity.Type getType();

    void setType(ConnectionEntity.Type type);

    @MappingSingular
    Map<String, Object> getConfig();

    void setConfig(Map<String, Object> config);

}
