/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination.pulsar;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.apache.pulsar.client.admin.PulsarAdminBuilder;
import org.apache.pulsar.client.impl.auth.AuthenticationToken;
import org.json.JSONException;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Named("JWT")
@ApplicationScoped
public class JwtAuthHandler implements PulsarAuthHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(JwtAuthHandler.class);

    @Override
    public void configure(PulsarAdminBuilder builder, Map<String, Object> config) {
        String jwtToken = (String) config.get("jwtToken");

        AuthenticationToken auth = new AuthenticationToken();
        auth.configure(jwtToken);
        builder.authentication(auth);
    }

    @Override
    public void validate(Map<String, Object> config) throws IllegalArgumentException {
        if (isConfigValueMissing(config, "jwtToken")) {
            throw new IllegalArgumentException("JWT token is missing or blank");
        }

        String jwtToken = config.get("jwtToken").toString();

        // Basic JWT validation: 3 parts separated by '.'
        String[] parts = jwtToken.split("\\.");
        if (parts.length != 3) {
            throw new IllegalArgumentException("JWT token must consist of exactly 3 Base64URL-encoded parts separated by '.'");
        }

        // Check parts are not empty
        for (String part : parts) {
            if (part.isEmpty()) {
                throw new IllegalArgumentException("JWT token parts must not be empty");
            }
        }

        // We do not have access to the key to verify the signature (yet), so doing basic checks
        byte[] headerBytes = decodeBase64Url(parts[0], "header");
        byte[] payloadBytes = decodeBase64Url(parts[1], "payload");

        JSONObject header = parseJson(headerBytes, "header");
        JSONObject claims = parseJson(payloadBytes, "payload");

        validateHeader(header);
        // Check if exp claim exists and is valid
        // bin/pulsar tokens create ... --expiry-time 1y
        validateClaims(claims);
        // TODO: Implement signature verification when key management is available

    }

    private byte[] decodeBase64Url(String part, String partName) throws IllegalArgumentException {
        try {
            return Base64.getUrlDecoder().decode(part);
        }
        catch (IllegalArgumentException e) {
            LOGGER.warn("JWT token {} part is not valid Base64URL: {}", partName, e.getMessage());
            throw new IllegalArgumentException("JWT token " + partName + " must be a valid Base64URL-encoded value", e);
        }
    }

    private JSONObject parseJson(byte[] bytes, String partName) throws IllegalArgumentException {
        try {
            return new JSONObject(new String(bytes, StandardCharsets.UTF_8));
        }
        catch (JSONException e) {
            LOGGER.warn("JWT token {} part decoded successfully but is not valid JSON: {}", partName, e.getMessage());
            throw new IllegalArgumentException("JWT token " + partName + " must decode to a valid JSON object", e);
        }
    }

    private void validateHeader(JSONObject header) throws IllegalArgumentException {
        if (!header.has("alg")) {
            LOGGER.warn("JWT token header is missing the required 'alg' field");
            throw new IllegalArgumentException("JWT token header must contain the 'alg' field");
        }
    }

    private void validateClaims(JSONObject claims) throws IllegalArgumentException {
        if (claims.has("exp")) {
            try {
                long expTimestamp = claims.getLong("exp");
                if (expTimestamp * 1000 <= System.currentTimeMillis()) {
                    LOGGER.warn("JWT token has expired (exp={})", expTimestamp);
                    throw new IllegalArgumentException("JWT token has expired");
                }
            }
            catch (JSONException e) {
                LOGGER.warn("JWT token 'exp' claim is not a valid number: {}", e.getMessage());
                throw new IllegalArgumentException("JWT token 'exp' claim must be a valid numeric timestamp", e);
            }
        }
    }
}
