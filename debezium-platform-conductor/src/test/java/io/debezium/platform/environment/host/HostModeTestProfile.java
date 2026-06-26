/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import java.util.Map;

import io.quarkus.test.junit.QuarkusTestProfile;

/**
 * Test profile that sets {@code debezium.deployment.mode=host} to activate
 * the host deployment path for CDI bean selection tests.
 */
public class HostModeTestProfile implements QuarkusTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of(
                "debezium.deployment.mode", "host",
                "quarkus.oras.devservices.base-port", "25001");
    }

    @Override
    public String getConfigProfile() {
        return "test";
    }
}
