/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import java.util.Map;

import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;

public class TestConnectionView implements Connection {

    private final Map<String, Object> config;
    private final ConnectionEntity.Type type;

    public TestConnectionView(ConnectionEntity.Type type, Map<String, Object> config) {
        this.config = config;
        this.type = type;
    }

    @Override
    public ConnectionEntity.Type getType() {
        return type;
    }

    @Override
    public Map<String, Object> getConfig() {
        return config;
    }

    @Override
    public void setName(String name) {

    }

    @Override
    public void setType(ConnectionEntity.Type type) {

    }

    @Override
    public void setConfig(Map<String, Object> config) {

    }

    @Override
    public String getName() {
        return "test";
    }

    @Override
    public Long getId() {
        return 0L;
    }
}
