/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import java.util.Map;
import java.util.Set;

import io.debezium.platform.environment.connection.destination.KafkaConnectionValidator;
import io.debezium.platform.environment.connection.source.DatabaseConnectionValidator;
import io.quarkus.test.junit.QuarkusTestProfile;

public class CustomTestProfile implements QuarkusTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        // Exclude production validators to avoid duplicate @Named key conflict
        // with their test alternatives during the Qute build processor bean scan
        return Map.of("quarkus.arc.exclude-types",
                KafkaConnectionValidator.class.getName() + "," + DatabaseConnectionValidator.class.getName());
    }

    @Override
    public Set<Class<?>> getEnabledAlternatives() {
        return Set.of(TestDatabaseConnectionValidator.class, TestKafkaConnectionValidator.class, TestAzureEventHubsConnectionValidator.class);
    }

    @Override
    public String getConfigProfile() {
        return "custom-profile";
    }
}
