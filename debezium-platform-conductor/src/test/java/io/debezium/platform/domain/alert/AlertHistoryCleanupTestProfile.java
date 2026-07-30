/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import java.util.Map;

import io.quarkus.test.junit.QuarkusTestProfile;

public class AlertHistoryCleanupTestProfile implements QuarkusTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of("alerting.history.retention", "1s");
    }
}
