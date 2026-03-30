package io.debezium.platform.environment.connection;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.PulsarConnectionValidator;
import io.debezium.platform.environment.destination.ApachePulsarTestResourceOAuth2Auth;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.pulsar.PulsarContainer;
import org.testcontainers.shaded.org.awaitility.Awaitility;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static io.debezium.platform.environment.destination.ApachePulsarTestResourceOAuth2Auth.TEST_TOKEN_SECRET_KEY;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
@QuarkusTestResource(value = ApachePulsarTestResourceOAuth2Auth.class, restrictToAnnotatedClass = true)
public class PulsarConnectionValidatorOAuth2IT {
    @Inject
    PulsarConnectionValidator validator;

    @Test
    @DisplayName("Should successfully validate connection with valid Pulsar configuration")
    void shouldValidateSuccessfulConnection() {
        PulsarContainer container = ApachePulsarTestResourceOAuth2Auth.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        Map<String, Object> config = new HashMap<>();
        config.put("authScheme", "oauth2");
        config.put("serviceHttpUrl", container.getHttpServiceUrl());
        config.put("oauth2PrivateKey", TEST_TOKEN_SECRET_KEY);
        config.put("oauth2IssuerUrl", ApachePulsarTestResourceOAuth2Auth.getIssuerUrl());

        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertTrue(result.valid(), "Connection validation should succeed");
    }

    @Test
    @DisplayName("Should fail validation when OAuth2 private key has wrong data URI prefix")
    void shouldFailValidationWithMalFormedPrivateKey() {
        PulsarContainer container = ApachePulsarTestResourceOAuth2Auth.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // Expected format: data:application/json;base64,<base64-encoded value>
        Map<String, Object> config = new HashMap<>();
        config.put("authScheme", "oauth2");
        config.put("serviceHttpUrl", container.getHttpServiceUrl());
        config.put("oauth2PrivateKey", "data:;base64,ewogICJjbGllbnRfaWQiOiAiYWRtaW4iLAogICJjbGllbnRfc2VjcmV0IjogImNsaWVudHNlY3JldCIsCiAgImdyYW50X3R5cGUiOiAiY2xpZW50X2NyZWRlbnRpYWxzIgp9Cg==");
        config.put("oauth2IssuerUrl", ApachePulsarTestResourceOAuth2Auth.getIssuerUrl());

        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail because the private key data URI is missing the 'application/json' media type");
    }

    @Test
    @DisplayName("Should fail validation when OAuth2 private key does not decode to a JSON object")
    void shouldFailValidationWithWrongFormatOfPrivateKey() {
        PulsarContainer container = ApachePulsarTestResourceOAuth2Auth.getContainer();

        Awaitility.await()
                .atMost(300, TimeUnit.SECONDS)
                .until(container::isRunning);

        // The privateKey parameter should contain the client_id and client_secret fields at least:
        // { "client_id": "foo", "client_secret": "foosecret" }
        String wrongEncodedData = Base64.getEncoder().encodeToString("foo:foosecret".getBytes(StandardCharsets.UTF_8));
        String wrongPrivateKey = "data:;base64," + wrongEncodedData;

        Map<String, Object> config = new HashMap<>();
        config.put("authScheme", "oauth2");
        config.put("serviceHttpUrl", container.getHttpServiceUrl());
        config.put("oauth2PrivateKey", wrongPrivateKey);
        config.put("oauth2IssuerUrl", ApachePulsarTestResourceOAuth2Auth.getIssuerUrl());

        Connection connection = new TestConnectionView(ConnectionEntity.Type.APACHE_PULSAR, config);

        ConnectionValidationResult result = validator.validate(connection);

        assertFalse(result.valid(), "Connection validation should fail because the Base64-decoded private key is not a JSON object");
    }
}
