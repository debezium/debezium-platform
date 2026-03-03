package io.debezium.platform.environment.connection;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.PravegaConnectionValidator;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(value = PravegaTestResource.class, restrictToAnnotatedClass = true)
public class PravegaConnectionValidatorIT {

    private static final int DEFAULT_TIMEOUT_SECONDS = 30;

    private PravegaConnectionValidator validator;

    @BeforeEach
    void setUp() {
        GenericContainer<?> container = PravegaTestResource.getContainer();
        String controllerUri = "tcp://" + container.getHost() + ":" + container.getMappedPort(9090);
        validator = new PravegaConnectionValidator(DEFAULT_TIMEOUT_SECONDS);
    }

    @Test
    @DisplayName("Should successfully validate connection with valid Pravega configuration")
    void shouldValidateSuccessfulConnection() {
        GenericContainer<?> container = PravegaTestResource.getContainer();
        String controllerUri = "tcp://" + container.getHost() + ":" + container.getMappedPort(9090);

        Map<String, Object> config = new HashMap<>();
        config.put("controllerUri", controllerUri);
        config.put("scope", "testScope");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.PRAVEGA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed");
    }

    @Test
    @DisplayName("Should fail validation when controller URI is not provided")
    void shouldFailValidationWithoutControllerUri() {

        Map<String, Object> config = new HashMap<>();
        config.put("scope", "testScope");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.PRAVEGA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Controller URI must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when controller URI is null")
    void shouldFailValidationWithNullControllerUri() {

        Map<String, Object> config = new HashMap<>();
        config.put("controllerUri", null);
        config.put("scope", "testScope");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.PRAVEGA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Controller URI must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when controller URI is empty")
    void shouldFailValidationWithEmptyControllerUri() {

        Map<String, Object> config = new HashMap<>();
        config.put("controllerUri", "");
        config.put("scope", "testScope");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.PRAVEGA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Controller URI must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when scope is not provided")
    void shouldFailValidationWithoutScope() {
        GenericContainer<?> container = PravegaTestResource.getContainer();
        String controllerUri = "tcp://" + container.getHost() + ":" + container.getMappedPort(9090);

        Map<String, Object> config = new HashMap<>();
        config.put("controllerUri", controllerUri);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.PRAVEGA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Scope must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when scope is empty")
    void shouldFailValidationWithEmptyScope() {
        GenericContainer<?> container = PravegaTestResource.getContainer();
        String controllerUri = "tcp://" + container.getHost() + ":" + container.getMappedPort(9090);

        Map<String, Object> config = new HashMap<>();
        config.put("controllerUri", controllerUri);
        config.put("scope", "");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.PRAVEGA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Scope must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when scope is null")
    void shouldFailValidationWithNullScope() {
        GenericContainer<?> container = PravegaTestResource.getContainer();
        String controllerUri = "tcp://" + container.getHost() + ":" + container.getMappedPort(9090);

        Map<String, Object> config = new HashMap<>();
        config.put("controllerUri", controllerUri);
        config.put("scope", null);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.PRAVEGA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Scope must be specified", result.message());
    }

    @Test
    @DisplayName("Should fail validation when connection config is null")
    void shouldFailValidationWithNullConnection() {

        ConnectionValidationResult result = validator.validate(null);

        assertFalse(result.valid(), "Connection validation should fail");
        assertEquals("Connection configuration cannot be null", result.message());
    }

    @Test
    @DisplayName("Should fail validation with unreachable controller")
    void shouldFailValidationWithUnreachableController() {

        Map<String, Object> config = new HashMap<>();
        config.put("controllerUri", "tcp://localhost:19999");
        config.put("scope", "testScope");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.PRAVEGA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
    }

    @Test
    @DisplayName("Should handle timeout scenarios gracefully")
    void shouldHandleTimeoutScenarios() {

        Map<String, Object> config = new HashMap<>();
        config.put("controllerUri", "tcp://10.255.255.1:9090");
        config.put("scope", "testScope");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.PRAVEGA, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail");
        assertTrue(result.message().contains("Failed to connect"),
                "Error message should indicate connection failure");
    }
}
