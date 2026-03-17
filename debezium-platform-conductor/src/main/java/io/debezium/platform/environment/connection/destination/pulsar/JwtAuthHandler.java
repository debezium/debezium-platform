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
import org.apache.pulsar.client.impl.auth.AuthenticationToken;
import org.json.JSONException;
import org.json.JSONObject;

@Named("JWT")
@ApplicationScoped
public class JwtAuthHandler implements PulsarAuthHandler {
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
            throw new IllegalArgumentException("invalid or missing jwtToken");
        }

        String jwtToken = config.get("jwtToken").toString();

        // Basic JWT validation: 3 parts separated by '.'
        String[] parts = jwtToken.split("\\.");
        if (parts.length != 3) {
            throw new IllegalArgumentException("invalid jwtToken format");
        }

        // Check parts are not empty
        for (String part : parts) {
            if (part.isEmpty()) {
                throw new IllegalArgumentException("Invalid JWT format: token parts cannot be empty");
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
            throw new IllegalArgumentException("Invalid JWT: " + partName + " is not valid Base64URL");
        }
    }

    private JSONObject parseJson(byte[] bytes, String partName) throws IllegalArgumentException {
        try {
            return new JSONObject(new String(bytes, StandardCharsets.UTF_8));
        }
        catch (JSONException e) {
            throw new IllegalArgumentException("Invalid JWT: " + partName + " is not valid JSON");
        }
    }

    private void validateHeader(JSONObject header) throws IllegalArgumentException {
        if (!header.has("alg")) {
            throw new IllegalArgumentException("Invalid JWT: header missing 'alg' field");
        }
    }

    private void validateClaims(JSONObject claims) throws IllegalArgumentException {
        if (claims.has("exp")) {
            try {
                long expTimestamp = claims.getLong("exp");
                if (expTimestamp * 1000 <= System.currentTimeMillis()) {
                    throw new IllegalArgumentException("Invalid JWT: token has expired");
                }
            }
            catch (JSONException e) {
                throw new IllegalArgumentException("Invalid JWT: 'exp' claim is not a valid number");
            }
        }
    }
}
