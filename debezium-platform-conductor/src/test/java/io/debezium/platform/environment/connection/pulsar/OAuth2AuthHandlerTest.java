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
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.environment.connection.destination.pulsar.OAuth2AuthHandler;

public class OAuth2AuthHandlerTest {

    private static final String PREFIX = "data:application/json;base64,";
    private static final String CREDENTIALS = "{\"client_id\":\"admin\",\"client_secret\":\"s3cret\"}";
    private static final String ISSUER_URL = "http://issuer.example.com";

    private OAuth2AuthHandler handler;

    @BeforeEach
    void setUp() {
        handler = new OAuth2AuthHandler();
    }

    private static String base64(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static Map<String, Object> config(String privateKey) {
        return Map.of("oauth2PrivateKey", privateKey, "oauth2IssuerUrl", ISSUER_URL);
    }

    @Test
    @DisplayName("Should validate a private key supplied as a data URI")
    void shouldValidateDataUriPrivateKey() {
        assertDoesNotThrow(() -> handler.validate(config(PREFIX + base64(CREDENTIALS))));
    }

    @Test
    @DisplayName("Should reject a private key that is not a data URI, even when the remainder decodes to valid credentials")
    void shouldRejectPrivateKeyWithoutDataUriPrefix() {
        // Bare base64, no "data:application/json;base64," prefix. The first 28 characters are
        // padding, so slicing them off leaves a perfectly decodable credentials document — which
        // is exactly why this has to be rejected on the prefix rather than on what decodes.
        String bare = base64("X".repeat(21) + CREDENTIALS);

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config(bare)));
    }

    @Test
    @DisplayName("Should reject a data URI with anything pasted in front of the prefix")
    void shouldRejectPrivateKeyWithTextBeforeThePrefix() {
        // A contains-check would accept this and let it through to the Pulsar client, which then
        // fails while building its URI. The prefix has to be at position 0.
        String prefixedWithJunk = "junk" + PREFIX + base64(CREDENTIALS);

        assertThrows(IllegalArgumentException.class, () -> handler.validate(config(prefixedWithJunk)));
    }

    @Test
    @DisplayName("Should reject a private key shorter than the data URI prefix with IllegalArgumentException")
    void shouldRejectPrivateKeyShorterThanPrefix() {
        assertThrows(IllegalArgumentException.class, () -> handler.validate(config("abc")));
    }

    @Test
    @DisplayName("Should reject a data URI whose payload is not valid Base64")
    void shouldRejectNonBase64Payload() {
        assertThrows(IllegalArgumentException.class, () -> handler.validate(config(PREFIX + "not*valid*base64")));
    }

    @Test
    @DisplayName("Should reject a data URI whose payload does not decode to JSON")
    void shouldRejectPayloadThatIsNotJson() {
        assertThrows(IllegalArgumentException.class, () -> handler.validate(config(PREFIX + base64("plain text"))));
    }

    @Test
    @DisplayName("Should reject credentials missing client_id or client_secret")
    void shouldRejectCredentialsMissingRequiredFields() {
        assertThrows(IllegalArgumentException.class,
                () -> handler.validate(config(PREFIX + base64("{\"client_id\":\"admin\"}"))));
        assertThrows(IllegalArgumentException.class,
                () -> handler.validate(config(PREFIX + base64("{\"client_secret\":\"s3cret\"}"))));
    }

    @Test
    @DisplayName("Should fail validation when the private key or issuer url is missing")
    void shouldFailWhenRequiredValuesAreMissing() {
        assertThrows(IllegalArgumentException.class,
                () -> handler.validate(Map.of("oauth2IssuerUrl", ISSUER_URL)));
        assertThrows(IllegalArgumentException.class,
                () -> handler.validate(Map.of("oauth2PrivateKey", PREFIX + base64(CREDENTIALS))));
    }
}
