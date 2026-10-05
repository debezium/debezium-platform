/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;

import jakarta.enterprise.inject.Instance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.environment.connection.source.DatabaseConnectionValidator;

class ConnectionValidatorFactoryTest {

    private ConnectionValidatorFactory factory;
    private ConnectionValidator databaseValidator;
    private ConnectionValidator kafkaValidator;
    private ConnectionValidator eventHubsValidator;
    private ConnectionValidator rocketMqValidator;

    @BeforeEach
    void setUp() {
        // Create mock validators
        databaseValidator = mock(DatabaseConnectionValidator.class);
        kafkaValidator = mock(ConnectionValidator.class);
        eventHubsValidator = mock(ConnectionValidator.class);
        rocketMqValidator = mock(ConnectionValidator.class);

        // Configure mock responses
        when(databaseValidator.validate(any())).thenReturn(ConnectionValidationResult.successful());
        when(kafkaValidator.validate(any())).thenReturn(ConnectionValidationResult.failed("Bootstrap servers must be specified"));
        when(eventHubsValidator.validate(any())).thenReturn(ConnectionValidationResult.failed("Connection string must be specified"));
        when(rocketMqValidator.validate(any())).thenReturn(ConnectionValidationResult.failed("Name server address must be specified"));

        // Mock the CDI Instance
        @SuppressWarnings("unchecked")
        Instance<ConnectionValidator> validators = mock(Instance.class);

        @SuppressWarnings("unchecked")
        Instance<ConnectionValidator> databaseInstance = mock(Instance.class);
        @SuppressWarnings("unchecked")
        Instance<ConnectionValidator> kafkaInstance = mock(Instance.class);
        @SuppressWarnings("unchecked")
        Instance<ConnectionValidator> eventHubsInstance = mock(Instance.class);
        @SuppressWarnings("unchecked")
        Instance<ConnectionValidator> rocketMqInstance = mock(Instance.class);

        when(databaseInstance.get()).thenReturn(databaseValidator);
        when(kafkaInstance.get()).thenReturn(kafkaValidator);
        when(eventHubsInstance.get()).thenReturn(eventHubsValidator);
        when(rocketMqInstance.get()).thenReturn(rocketMqValidator);

        when(validators.select(any())).thenAnswer(invocation -> {
            String name = invocation.getArgument(0).toString();
            if (name.contains("DATABASE")) {
                return databaseInstance;
            }
            else if (name.contains("KAFKA")) {
                return kafkaInstance;
            }
            else if (name.contains("AZURE_EVENTS_HUBS")) {
                return eventHubsInstance;
            }
            else if (name.contains("APACHE_ROCKETMQ")) {
                return rocketMqInstance;
            }
            return databaseInstance;
        });

        factory = new ConnectionValidatorFactory(validators);
    }

    @Test
    void shouldReturnDatabaseValidatorForOracle() {
        ConnectionValidator validator = factory.getValidator("ORACLE");
        assertNotNull(validator);
        assertTrue(validator.validate(new TestConnectionView(ConnectionEntity.Type.ORACLE, Map.of())).valid());
    }

    @Test
    void shouldReturnKafkaValidator() {
        ConnectionValidator validator = factory.getValidator("KAFKA");
        assertNotNull(validator);
        assertFalse(validator.validate(new TestConnectionView(ConnectionEntity.Type.KAFKA, Map.of())).valid());
    }

    @Test
    void shouldReturnEventHubsValidator() {
        ConnectionValidator validator = factory.getValidator(ConnectionEntity.Type.AZURE_EVENTS_HUBS.name());
        assertNotNull(validator);
        assertFalse(validator.validate(new TestConnectionView(ConnectionEntity.Type.AZURE_EVENTS_HUBS, Map.of())).valid());
    }

    @Test
    void shouldReturnRocketMqValidator() {
        ConnectionValidator validator = factory.getValidator(ConnectionEntity.Type.APACHE_ROCKETMQ.name());
        assertNotNull(validator);
        assertFalse(validator.validate(new TestConnectionView(ConnectionEntity.Type.APACHE_ROCKETMQ, Map.of())).valid());
    }
}