/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

io.debezium.platform.data.model.ConnectionEntity;
io.debezium.platform.domain.views.Connection;
io.debezium.platform.environment.connection.destination.NatsStreamingConnectionValidator;
import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.NatsStreamingConnectionValidator;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
class NatsStreamingConnectionValidatorIT {

    private static final int DEFAULT_TIMEOUT_SECONDS = 30;

    private NatsStreamingConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new NatsStreamingConnectionValidator(DEFAULT_TIMEOUT_SECONDS);
    }

    @Test
    @DisplayName("Should validate connection with valid NATS Streaming configuration")
    void shouldValidateSuccessfulConnection() {
        try (GenericContainer<?> natsContainer = new GenericContainer<>(DockerImageName.parse("nats:latest"))
                .withExposedPorts(4222)) {
            natsContainer.start();

            Map<String, Object> config = new HashMap<>();
            config.put("host", natsContainer.getHost());
            config.put("port", natsContainer.getMappedPort(4222));
            config.put("cluster.id", "test-cluster");
            config.put("client.id", "test-client");

            Connection connection = new TestConnectionView(ConnectionEntity.Type.NATS_STREAMING, config);
            ConnectionValidationResult result = validator.validate(connection);
            assertTrue(result.valid(), "Connection validation should succeed");
        }
    }

    @Test
    @DisplayName("Should fail validation when host is missing")
    void shouldFailWhenHostMissing() {
        Map<String, Object> config = new HashMap<>();
        config.put("port", 4222);
        config.put("cluster.id", "test-cluster");
        config.put("client.id", "test-client");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.NATS_STREAMING, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation must fail when host is missing");
    }

    @Test
    @DisplayName("Should fail validation with invalid cluster.id/client.id")
    void shouldFailWithInvalidClusterOrClientId() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "localhost");
        config.put("port", 4222);
        config.put("cluster.id", "wrong-cluster");
        config.put("client.id", "wrong-client");

        Connection connection = new TestConnectionView(ConnectionEntity.Type.NATS_STREAMING, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Validation must fail with bad cluster.id/client.id");
    }
}