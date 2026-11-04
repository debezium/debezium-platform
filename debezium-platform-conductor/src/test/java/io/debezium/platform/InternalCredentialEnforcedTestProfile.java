/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform;

import java.util.HashMap;
import java.util.Map;

import io.quarkus.test.junit.QuarkusTestProfile;

/**
 * {@link IamEnabledTestProfile} plus a configured internal-credential secret, so
 * {@code InternalCredentialService.isEnforcementActive()} is true (debezium/dbz#3003): both IAM
 * is on and the secret is set, which is the one state in which {@code InternalCredentialFilter}
 * performs real HMAC verification rather than falling back to the proxy-provenance heuristic.
 * Used by {@code InternalCredentialIT}, the only suite that exercises {@code /api/internal/*}
 * with enforcement actually active end to end.
 */
public class InternalCredentialEnforcedTestProfile implements QuarkusTestProfile {
    @Override
    public Map<String, String> getConfigOverrides() {
        Map<String, String> overrides = new HashMap<>(new IamEnabledTestProfile().getConfigOverrides());
        overrides.put("conductor.security.internal-credential.secret", "it-test-internal-credential-secret");
        overrides.put("quarkus.oras.devservices.base-port", "25011");
        return overrides;
    }
}
