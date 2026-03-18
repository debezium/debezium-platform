/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.pulsar;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.environment.connection.destination.pulsar.JwtAuthHandler;

public class JwtAuthHandlerTest {

    private JwtAuthHandler handler;

    @BeforeEach
    void setUp() {
        handler = new JwtAuthHandler();
    }

    @Test
    @DisplayName("Should validate well formed JWT token")
    void shouldValidateWellFormedJwtToken() {
        Map<String, Object> config = Map.of("jwtToken", validJwtToken());

        assertDoesNotThrow(() -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail when jwtToken is missing")
    void shouldFailWhenJwtTokenIsMissing() {
        Map<String, Object> config = new HashMap<>();

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail when jwtToken is null")
    void shouldFailWhenJwtTokenIsNull() {
        Map<String, Object> config = new HashMap<>();
        config.put("jwtToken", null);

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail when jwtToken is blank")
    void shouldFailWhenJwtTokenIsBlank() {
        Map<String, Object> config = Map.of("jwtToken", " ");

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail when jwtToken does not have three parts")
    void shouldFailWhenJwtTokenDoesNotHaveThreeParts() {
        Map<String, Object> config = Map.of("jwtToken", "only.two");

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail when jwtToken contains empty parts")
    void shouldFailWhenJwtTokenContainsEmptyParts() {
        Map<String, Object> config = Map.of("jwtToken", "header..signature");

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail when header is not valid Base64URL")
    void shouldFailWhenHeaderIsNotValidBase64Url() {
        String payload = base64Url("{\"sub\":\"user\"}");
        String token = "%%%." + payload + ".signature";

        Map<String, Object> config = Map.of("jwtToken", token);

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail when payload is not valid Base64URL")
    void shouldFailWhenPayloadIsNotValidBase64Url() {
        String header = base64Url("{\"alg\":\"RS256\"}");
        String token = header + ".%%%." + "signature";

        Map<String, Object> config = Map.of("jwtToken", token);

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail when decoded header is not valid JSON")
    void shouldFailWhenDecodedHeaderIsNotValidJson() {
        String header = base64Url("not-json");
        String payload = base64Url("{\"sub\":\"user\"}");
        String token = header + "." + payload + ".signature";

        Map<String, Object> config = Map.of("jwtToken", token);

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail when decoded payload is not valid JSON")
    void shouldFailWhenDecodedPayloadIsNotValidJson() {
        String header = base64Url("{\"alg\":\"RS256\"}");
        String payload = base64Url("not-json");
        String token = header + "." + payload + ".signature";

        Map<String, Object> config = Map.of("jwtToken", token);

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail when header does not contain alg")
    void shouldFailWhenHeaderDoesNotContainAlg() {
        String header = base64Url("{\"typ\":\"JWT\"}");
        String payload = base64Url("{\"sub\":\"user\"}");
        String token = header + "." + payload + ".signature";

        Map<String, Object> config = Map.of("jwtToken", token);

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail when exp claim is not a number")
    void shouldFailWhenExpClaimIsNotANumber() {
        String header = base64Url("{\"alg\":\"RS256\"}");
        String payload = base64Url("{\"sub\":\"user\",\"exp\":\"tomorrow\"}");
        String token = header + "." + payload + ".signature";

        Map<String, Object> config = Map.of("jwtToken", token);

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should fail when jwtToken is expired")
    void shouldFailWhenJwtTokenIsExpired() {
        long expiredEpochSeconds = (System.currentTimeMillis() / 1000) - 60;
        String header = base64Url("{\"alg\":\"RS256\"}");
        String payload = base64Url("{\"sub\":\"user\",\"exp\":" + expiredEpochSeconds + "}");
        String token = header + "." + payload + ".signature";

        Map<String, Object> config = Map.of("jwtToken", token);

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config));
    }

    @Test
    @DisplayName("Should validate when exp claim is in the future")
    void shouldValidateWhenJwtTokenHasFutureExpClaim() {
        long futureEpochSeconds = (System.currentTimeMillis() / 1000) + 3600;
        String header = base64Url("{\"alg\":\"RS256\"}");
        String payload = base64Url("{\"sub\":\"user\",\"exp\":" + futureEpochSeconds + "}");
        String token = header + "." + payload + ".signature";

        Map<String, Object> config = Map.of("jwtToken", token);

        assertDoesNotThrow(() -> handler.validate(config));
    }

    private static String validJwtToken() {
        String header = base64Url("{\"alg\":\"RS256\",\"typ\":\"JWT\"}");
        String payload = base64Url("{\"sub\":\"admin\"}");
        return header + "." + payload + ".signature";
    }

    private static String base64Url(String value) {
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
}
