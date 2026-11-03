/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import io.debezium.platform.config.SecurityConfigGroup;
import io.quarkus.runtime.StartupEvent;

/**
 * Fails the boot when the configuration would produce partial enforcement (debezium/dbz#3003,
 * FR-3): authentication on with nothing actually checked, or the reverse. A platform that boots
 * in a half-enforced state is worse than one that does not boot, because the operator believes
 * it is protected.
 *
 * <p><b>Deviation from the IAM design.</b> The design's checklist also validates that the host
 * agent's shared token is configured whenever the conductor is in agent-based host mode
 * ({@code pipeline.deployment.mode=host} and {@code pipeline.host.container-runtime=agent}).
 * That check is omitted here: verified against the codebase, the conductor holds no such static,
 * operator-configured token at all. {@code HostProvisioningService} mints a fresh per-host token
 * at provisioning time and persists it on the host record, so by construction a {@code READY}
 * host always carries one; there is nothing for a boot-time check to find unset. The host
 * agent's own fail-open removal (it refuses to start without {@code AGENT_TOKEN}) still applies
 * and is unaffected by this.
 */
@ApplicationScoped
public class EnforcementValidator {

    private static final String ISSUER_PLACEHOLDER = "https://keycloak.invalid/realms/none";
    private static final String TENANT_ENABLED_ENV_VAR = "QUARKUS_OIDC_TENANT_ENABLED";

    private final Logger logger;
    private final SecurityConfigGroup config;
    private final String issuer;
    private final Optional<String> audience;

    public EnforcementValidator(Logger logger, SecurityConfigGroup config,
                                @ConfigProperty(name = "quarkus.oidc.auth-server-url") String issuer,
                                @ConfigProperty(name = "quarkus.oidc.token.audience") Optional<String> audience) {
        this.logger = logger;
        this.config = config;
        this.issuer = issuer;
        this.audience = audience;
    }

    void onStart(@Observes StartupEvent event) {
        // Ambiguity on a security switch is never resolved by guessing, regardless of which
        // value conductor.security.enabled currently holds: authentication on with authorization
        // silently reporting disabled is exactly the partial-enforcement state this exists to
        // prevent, and so is the reverse.
        checkAmbiguousTenantSwitch();

        if (!config.enabled()) {
            logger.info("IAM is DISABLED. All API endpoints are unauthenticated and unauthorized.");
            return;
        }

        List<String> failures = new ArrayList<>();

        if (issuer == null || issuer.isBlank() || ISSUER_PLACEHOLDER.equals(issuer)) {
            failures.add("conductor.security.enabled is true but quarkus.oidc.auth-server-url (OIDC_ISSUER) is "
                    + "unset or still the placeholder. Configure the identity provider's issuer URL.");
        }
        if (audience.isEmpty() || audience.get().isBlank()) {
            failures.add("conductor.security.enabled is true but quarkus.oidc.token.audience (OIDC_AUDIENCE) is "
                    + "unset. Without it, a token minted for an unrelated client in the same realm is accepted "
                    + "(Quarkus skips audience validation entirely when this property is unset).");
        }

        checkRoleMappings(failures);

        if (!failures.isEmpty()) {
            throw new IllegalStateException("IAM configuration is invalid:\n  - " + String.join("\n  - ", failures));
        }

        if (config.internalCredential().secret().isEmpty()) {
            logger.warn("IAM is enabled but conductor.security.internal-credential.secret is unset. Debezium "
                    + "Server snapshot notifications are not authenticated by a credential; the pre-existing "
                    + "proxy-provenance check on /api/internal/* remains the only guard until the secret is "
                    + "configured and notification.http.authorization is available from Debezium core.");
        }

        int roleMappingCount = config.roleMappings().isEmpty()
                ? DefaultRoleMappings.bundles().size()
                : config.roleMappings().size();
        logger.infov("IAM is ENABLED. Issuer={0}, {1} role mapping(s){2}, {3} permissions in the catalogue.",
                issuer, roleMappingCount, config.roleMappings().isEmpty() ? " (shipped defaults)" : "",
                Permission.all().size());
    }

    private void checkAmbiguousTenantSwitch() {
        String rawTenantEnabled = System.getenv(TENANT_ENABLED_ENV_VAR);
        if (rawTenantEnabled == null) {
            return;
        }
        boolean directValue = Boolean.parseBoolean(rawTenantEnabled);
        if (directValue != config.enabled()) {
            throw new IllegalStateException(String.format(
                    "%s=%s was set directly, which disagrees with conductor.security.enabled=%s. "
                            + "quarkus.oidc.tenant-enabled is derived from conductor.security.enabled and must "
                            + "not be configured independently.",
                    TENANT_ENABLED_ENV_VAR, rawTenantEnabled, config.enabled()));
        }
    }

    private void checkRoleMappings(List<String> failures) {
        Set<String> seenRoles = new HashSet<>();
        for (SecurityConfigGroup.RoleMapping mapping : config.roleMappings()) {
            if (!seenRoles.add(mapping.role())) {
                failures.add("conductor.security.role-mappings declares role \"" + mapping.role()
                        + "\" more than once.");
            }
            for (String permissionId : mapping.permissions()) {
                if ("*".equals(permissionId) || Permission.byId(permissionId).isPresent()) {
                    continue;
                }
                failures.add("conductor.security.role-mappings: role \"" + mapping.role()
                        + "\" names unknown permission \"" + permissionId + "\"" + suggestionFor(permissionId));
            }
        }
    }

    private static String suggestionFor(String unknownPermissionId) {
        String nearest = null;
        int best = Integer.MAX_VALUE;
        for (Permission permission : Permission.all()) {
            int distance = levenshteinDistance(unknownPermissionId, permission.id());
            if (distance < best) {
                best = distance;
                nearest = permission.id();
            }
        }
        return nearest == null ? "" : " (did you mean \"" + nearest + "\"?)";
    }

    private static int levenshteinDistance(String a, String b) {
        int[][] distance = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) {
            distance[i][0] = i;
        }
        for (int j = 0; j <= b.length(); j++) {
            distance[0][j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int substitutionCost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                distance[i][j] = Math.min(
                        Math.min(distance[i - 1][j] + 1, distance[i][j - 1] + 1),
                        distance[i - 1][j - 1] + substitutionCost);
            }
        }
        return distance[a.length()][b.length()];
    }
}
