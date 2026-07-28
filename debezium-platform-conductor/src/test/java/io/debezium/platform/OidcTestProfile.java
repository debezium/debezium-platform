/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform;

import java.util.Map;

import io.quarkus.test.junit.QuarkusTestProfile;

public class OidcTestProfile implements QuarkusTestProfile {
    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of(
                "quarkus.oidc.tenant-enabled", "true",
                // Points at the WireMock issuer started by OidcWiremockTestResource, which exposes
                // its dynamic port as 'keycloak.url' and stubs the 'quarkus' realm.
                "quarkus.oidc.auth-server-url", "${keycloak.url}/realms/quarkus",
                "quarkus.oras.devservices.base-port", "25002");
    }
}
