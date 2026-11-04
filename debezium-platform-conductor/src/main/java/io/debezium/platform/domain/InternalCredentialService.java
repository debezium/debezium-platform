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
 * <pre>credential = CREDENTIAL_MARKER + base64url( HMAC-SHA256(secret, "pipeline:" + pipelineId) )</pre>
 *
 * <p>Derived, never stored: no table, no migration, and verification needs no database read.
 * The pipeline id is inside the MAC input, so a credential minted for one pipeline fails
 * verification for any other.
 */
@ApplicationScoped
public class InternalCredentialService {

    private static final String ALGORITHM = "HmacSHA256";
    private static final String CONTEXT_PREFIX = "pipeline:";
    private static final String BEARER_PREFIX = "Bearer ";

    /**
     * A fixed, non-secret marker prepended to every credential this service mints. {@code
     * looksLikeOurCredential} uses it to tell "one of ours" from "someone else's bearer value" by
     * exact structural match rather than by guessing from length and alphabet: an opaque
     * reference token from an identity provider (Okta, Auth0, Keycloak configured for the opaque
     * {@code access_token} format) can happen to be the same length as a base64url-encoded
     * HMAC-SHA256 output with no '.' in it, which the earlier, shape-only heuristic could not
     * tell apart from this service's own credential.
     */
    static final String CREDENTIAL_MARKER = "dbz-internal-cred.";

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
     * Whether {@code InternalCredentialFilter} should perform real HMAC verification rather than
     * fall back to the pre-existing proxy-provenance heuristic: a secret must be configured
     * <em>and</em> {@code conductor.security.enabled} must be true.
     *
     * <p>{@link #isConfigured()} alone is not enough: DDD-79's upgrade runbook for existing
     * deployments configures the secret first and only enables enforcement once every pipeline
     * has been redeployed to carry it (there is no periodic resync or redeploy-on-startup, so an
     * un-redeployed pipeline keeps its credential-less resource indefinitely). Gating on the
     * secret alone would start rejecting those pipelines' notifications the instant the secret is
     * set, before step 1 of that runbook is even complete.
     */
    public boolean isEnforcementActive() {
        return isConfigured() && config.enabled();
    }

    /**
     * @throws java.util.NoSuchElementException if no secret is configured; the caller
     *         ({@code PipelineMapper}) only calls this when one is present.
     */
    public String mint(Long pipelineId) {
        return compute(config.internalCredential().secret().orElseThrow(), pipelineId);
    }

    /**
     * The value to set as the {@code Authorization} header carrying a freshly minted credential.
     * Owns the {@code Bearer} wire convention so callers never hardcode it.
     */
    public String mintAuthorizationHeader(Long pipelineId) {
        return BEARER_PREFIX + mint(pipelineId);
    }

    /**
     * Strips the {@code Bearer} scheme from a raw {@code Authorization} header value. Returns
     * {@code null} when the header is absent or not a bearer value, so callers can treat "no
     * credential" and "malformed scheme" the same way.
     */
    public static String bearerToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith(BEARER_PREFIX)) {
            return null;
        }
        return authorizationHeader.substring(BEARER_PREFIX.length()).trim();
    }

    /**
     * Whether a bearer value is one of ours: see {@link #CREDENTIAL_MARKER}.
     */
    public static boolean looksLikeOurCredential(String token) {
        return token != null && token.startsWith(CREDENTIAL_MARKER);
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
            return CREDENTIAL_MARKER + Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
        }
        catch (NoSuchAlgorithmException | InvalidKeyException e) {
            // HmacSHA256 is a mandatory JCE algorithm and the key is never empty by construction;
            // this is unreachable by any caller-controlled input.
            throw new IllegalStateException("Unable to compute internal credential", e);
        }
    }
}
