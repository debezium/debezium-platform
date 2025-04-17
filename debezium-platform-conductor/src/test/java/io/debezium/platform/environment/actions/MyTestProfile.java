/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions;


import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.Map;

public class MyTestProfile implements QuarkusTestProfile {
    @Override
    public String getConfigProfile() {
        return "db-test";
    }

    @Override
    public Map<String, String> getConfigOverrides() {
        // Disable specific beans via configuration
        return Map.of(
                "quarkus.arc.exclude-types", "io.debezium.platform.environment.watcher.config.WatcherConfig,io.debezium.platform.environment.watcher.ConductorEnvironmentWatcher"
        );
    }
}
