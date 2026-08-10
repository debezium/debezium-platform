/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import java.util.Map;

import io.quarkus.test.junit.QuarkusTestProfile;

/**
 * Test profile that sets {@code platform.deployment.mode=host} to activate
 * the host deployment path for CDI bean selection tests.
 */
public class HostModeTestProfile implements QuarkusTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of(
                "platform.deployment.mode", "host",
                "conductor.watcher.enabled", "false",
                "conductor.descriptors.volume-source", "true",
                "quarkus.oras.devservices.base-port", "25010",
                "quarkus.arc.exclude-types",
                "io.debezium.platform.environment.watcher.config.WatcherConfig,io.debezium.platform.environment.watcher.ConductorEnvironmentWatcher");
    }

    @Override
    public String getConfigProfile() {
        return "test";
    }
}
