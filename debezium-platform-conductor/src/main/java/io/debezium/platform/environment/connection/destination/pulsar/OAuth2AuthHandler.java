/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination.pulsar;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.apache.pulsar.client.admin.PulsarAdminBuilder;
import org.apache.pulsar.client.impl.auth.oauth2.AuthenticationOAuth2;
import org.json.JSONException;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Named("OAUTH2")
@ApplicationScoped
public class OAuth2AuthHandler implements PulsarAuthHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(OAuth2AuthHandler.class);

    /**
     * Configures the provided {@link PulsarAdminBuilder} with the authentication settings
     * required by this handler.
     * <p>
     * Implementations may add authentication credentials or other related settings to the builder.
     * This method assumes that the supplied configuration has already been validated.
     * </p>
     *
     * @param builder the Pulsar admin builder to configure; must not be {@code null}
     * @param config  the Pulsar connection configuration containing authentication properties;
     *                must not be {@code null}
     */
    @Override
    public void configure(PulsarAdminBuilder builder, Map<String, Object> config) {
        String privateKey = (String) config.get("oauth2PrivateKey");
        String issuerUrl = (String) config.get("oauth2IssuerUrl");

        String authParams = String.format(
                "{\"privateKey\":\"%s\",\"issuerUrl\":\"%s\"}",
                privateKey,
                issuerUrl);

        AuthenticationOAuth2 auth = new AuthenticationOAuth2();
        auth.configure(authParams);
        builder.authentication(auth);
    }

    /**
     * Validates the authentication-related configuration required by this handler.
     * <p>
     * Implementations should verify that required configuration keys are present and that their
     * values are valid for the corresponding authentication scheme. If validation fails, an
     * {@link IllegalArgumentException} should be thrown with a descriptive message.
     * </p>
     *
     * @param config the Pulsar connection configuration to validate; must not be {@code null}
     * @throws IllegalArgumentException if required configuration values are missing, blank, or invalid
     */
    @Override
    public void validate(Map<String, Object> config) throws IllegalArgumentException {
        if (isConfigValueMissing(config, "oauth2PrivateKey")) {
            throw new IllegalArgumentException("Invalid or missing OAuth2 Private Key (base64-encoded JSON credentials)");
        }
        if (isConfigValueMissing(config, "oauth2IssuerUrl")) {
            throw new IllegalArgumentException("Invalid or missing OAuth2 Issuer Url");
        }

        String privateKey = config.get("oauth2PrivateKey").toString();
        byte[] privateKeyBytes = null;

        try {
            // Format as per the Pulsar doc -> data:application/json;base64,WaVf/RB7ZAW7pMG3rhxnL3zC2QFqyyLaKl5W6JwWdhw=
            String prefix = "data:application/json;base64,";
            String extracted = privateKey.substring(privateKey.indexOf(prefix) + prefix.length());
            privateKeyBytes = Base64.getDecoder().decode(extracted);
        }
        catch (IllegalArgumentException e) {
            LOGGER.warn("Failed to Base64-decode the OAuth2 private key: {}", e.getMessage());
            throw new IllegalArgumentException("OAuth2 Private Key must be a valid Base64-encoded value");
        }

        JSONObject privateKeyJson = null;
        try {
            privateKeyJson = new JSONObject(new String(privateKeyBytes, StandardCharsets.UTF_8));
        }
        catch (JSONException e) {
            LOGGER.warn("OAuth2 private key decoded successfully but is not valid JSON: {}", e.getMessage());
            throw new IllegalArgumentException("OAuth2 Private Key must decode to a valid JSON object");
        }

        if (!privateKeyJson.has("client_id") || !privateKeyJson.has("client_secret")) {
            LOGGER.warn("OAuth2 private key JSON is missing required fields: 'client_id' and/or 'client_secret'");
            throw new IllegalArgumentException("OAuth2 Private Key JSON must contain both 'client_id' and 'client_secret' fields");
        }

        String issuerUrl = config.get("oauth2IssuerUrl").toString();
    }
}
