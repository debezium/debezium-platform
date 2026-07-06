/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform;

import java.util.Map;

import io.quarkus.test.junit.QuarkusTestProfile;

public class MockedTestProfile implements QuarkusTestProfile {

    @Override
    public String getConfigProfile() {
        return "test"; // optional, for config resolution
    }

    @Override
    public Map<String, String> getConfigOverrides() {
        // This profile spins up a second Quarkus test context that coexists with the default
        // context. The quarkus-oras dev service binds a FIXED host port (base-port 25000, see
        // src/test/resources/application.properties) via addFixedExposedPort with no fallback, so a
        // second zot container cannot start alongside the default context's one -> "port already
        // allocated". Tests using this profile do not exercise the catalog/registry, so disable the
        // dev service here; the default-profile context (e.g. CatalogResourceIT) keeps the single zot.
        return Map.of("quarkus.oras.registries.registry.devservice", "false");
    }
}
