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
 * IAM on, against the WireMock mock issuer, with no {@code conductor.security.role-mappings}
 * configured so the shipped default bundles (dmp-admin/dmp-editor/dmp-operator/dmp-viewer) apply
 * (debezium/dbz#3003). Shared by every IT that only exercises the REST API and the OIDC layer:
 * {@code OidcSecurityIT}, {@code ProbeEndpointIT}, {@code AuthorizationIT},
 * {@code IdentityResourceIT}.
 *
 * <p>Also layers in {@link MinimalDevServicesTestProfile}'s reductions: none of the above touch
 * Kafka, the Kubernetes client, or the pipeline watchers, so there is no reason to pay for them
 * on every restart this profile forces.
 */
public class IamEnabledTestProfile implements QuarkusTestProfile {
    @Override
    public Map<String, String> getConfigOverrides() {
        Map<String, String> overrides = new HashMap<>(new MinimalDevServicesTestProfile().getConfigOverrides());
        overrides.put("conductor.security.enabled", "true");
        overrides.put("quarkus.oidc.auth-server-url", "${keycloak.url}/realms/quarkus");
        overrides.put("quarkus.oidc.token.audience", "https://server.example.com");
        overrides.put("quarkus.oras.devservices.base-port", "25002");
        return overrides;
    }
}
