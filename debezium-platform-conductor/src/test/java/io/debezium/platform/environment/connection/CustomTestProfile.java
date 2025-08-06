/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import java.util.Collections;
import java.util.Map;
import java.util.Set;

import io.quarkus.test.junit.QuarkusTestProfile;

public class CustomTestProfile implements QuarkusTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Collections.emptyMap();
    }

    @Override
    public Set<Class<?>> getEnabledAlternatives() {
        return Set.of(TestDatabaseConnectionValidator.class, TestKafkaConnectionValidator.class);
    }

    @Override
    public String getConfigProfile() {
        return "custom-profile";
    }
}
