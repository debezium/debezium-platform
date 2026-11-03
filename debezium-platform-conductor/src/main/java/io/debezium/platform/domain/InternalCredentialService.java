/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import io.debezium.platform.config.SecurityConfigGroup;

/**
 * Mints and verifies the per-pipeline credential Debezium Server presents on the snapshot
 * notification callback (debezium/dbz#3003).
 *
 * <pre>credential = base64url( HMAC-SHA256(secret, "pipeline:" + pipelineId) )</pre>
 *
 * <p>Derived, never stored: no table, no migration, and verification needs no database read.
 * The pipeline id is inside the MAC input, so a credential minted for one pipeline fails
 * verification for any other.
 */
@ApplicationScoped
public class InternalCredentialService {

    private static final String ALGORITHM = "HmacSHA256";
    private static final String CONTEXT_PREFIX = "pipeline:";

    private final SecurityConfigGroup config;

    public InternalCredentialService(SecurityConfigGroup config) {
        this.config = config;
    }

    /**
     * Whether a current secret is configured at all. {@code InternalCredentialFilter} reads this
     * rather than {@link SecurityConfigGroup} directly: a JAX-RS {@code @Provider} filter's
     * constructor dependencies can be resolved eagerly, before all config mappings are
     * necessarily available in every build, whereas this plain {@code @ApplicationScoped}
     * service is resolved lazily, on first real use.
     */
    public boolean isConfigured() {
        return config.internalCredential().secret().isPresent();
    }

    /**
     * @throws java.util.NoSuchElementException if no secret is configured; the caller
     *         ({@code PipelineMapper}) only calls this when one is present.
     */
    public String mint(Long pipelineId) {
        return compute(config.internalCredential().secret().orElseThrow(), pipelineId);
    }

    /**
     * Always evaluates the current secret, even when the previous one would match, so the
     * comparison cost does not reveal which secret matched.
     */
    public boolean verify(Long pipelineId, String presented) {
        if (presented == null || presented.isEmpty()) {
            return false;
        }

        Optional<String> current = config.internalCredential().secret();
        Optional<String> previous = config.internalCredential().previousSecret();

        boolean matchesCurrent = current.map(secret -> constantTimeEquals(compute(secret, pipelineId), presented))
                .orElse(false);
        boolean matchesPrevious = previous.map(secret -> constantTimeEquals(compute(secret, pipelineId), presented))
                .orElse(false);

        return matchesCurrent || matchesPrevious;
    }

    private static boolean constantTimeEquals(String expected, String candidate) {
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                candidate.getBytes(StandardCharsets.UTF_8));
    }

    private static String compute(String secret, Long pipelineId) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), ALGORITHM));
            byte[] signature = mac.doFinal((CONTEXT_PREFIX + pipelineId).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
        }
        catch (NoSuchAlgorithmException | InvalidKeyException e) {
            // HmacSHA256 is a mandatory JCE algorithm and the key is never empty by construction;
            // this is unreachable by any caller-controlled input.
            throw new IllegalStateException("Unable to compute internal credential", e);
        }
    }
}
