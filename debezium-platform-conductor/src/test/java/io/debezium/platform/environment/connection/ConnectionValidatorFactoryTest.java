/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;

import jakarta.inject.Inject;

import org.junit.jupiter.api.Test;

import io.debezium.platform.data.model.ConnectionEntity;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

@QuarkusTest
@TestProfile(CustomTestProfile.class)
class ConnectionValidatorFactoryTest {

    @Inject
    ConnectionValidatorFactory factory;

    @Test
    void shouldReturnDatabaseValidatorForOracle() {
        ConnectionValidator validator = factory.getValidator("ORACLE");
        assertTrue(validator.validate(new TestConnectionView(ConnectionEntity.Type.ORACLE, Map.of())).valid());
    }

    @Test
    void shouldReturnKafkaValidator() {
        ConnectionValidator validator = factory.getValidator("KAFKA");
        assertFalse(validator.validate(new TestConnectionView(ConnectionEntity.Type.KAFKA, Map.of())).valid());
    }
}
