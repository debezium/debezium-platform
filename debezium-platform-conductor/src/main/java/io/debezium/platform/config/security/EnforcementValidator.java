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
import java.util.stream.Collectors;

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

    private final Logger logger;
    private final SecurityConfigGroup securityConfig;
    private final String issuer;
    private final Optional<String> audience;
    private final boolean tenantEnabled;

    public EnforcementValidator(Logger logger, SecurityConfigGroup securityConfig,
                                @ConfigProperty(name = "quarkus.oidc.auth-server-url") String issuer,
                                @ConfigProperty(name = "quarkus.oidc.token.audience") Optional<String> audience,
                                @ConfigProperty(name = "quarkus.oidc.tenant-enabled") boolean tenantEnabled) {
        this.logger = logger;
        this.securityConfig = securityConfig;
        this.issuer = issuer;
        this.audience = audience;
        this.tenantEnabled = tenantEnabled;
    }

    void onStart(@Observes StartupEvent event) {
        // Ambiguity on a security switch is never resolved by guessing, regardless of which
        // value conductor.security.enabled currently holds: authentication on with authorization
        // silently reporting disabled is exactly the partial-enforcement state this exists to
        // prevent, and so is the reverse.
        checkAmbiguousTenantSwitch();

        if (!securityConfig.enabled()) {
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

        if (securityConfig.internalCredential().secret().isEmpty()) {
            logger.warn("IAM is enabled but conductor.security.internal-credential.secret is unset. Debezium "
                    + "Server snapshot notifications are not authenticated by a credential; the pre-existing "
                    + "proxy-provenance check on /api/internal/* remains the only guard until the secret is "
                    + "configured and notification.http.authorization is available from Debezium core.");
        }

        int roleMappingCount = securityConfig.roleMappings().isEmpty()
                ? DefaultRoleMappings.bundles().size()
                : securityConfig.roleMappings().size();
        logger.infov("IAM is ENABLED. Issuer={0}, {1} role mapping(s){2}, {3} permissions in the catalogue.",
                issuer, roleMappingCount, securityConfig.roleMappings().isEmpty() ? " (shipped defaults)" : "",
                Permission.all().size());
    }

    private void checkAmbiguousTenantSwitch() {
        // quarkus.oidc.tenant-enabled is derived from conductor.security.enabled via property
        // expansion in application.yml, so the two agree unless something overrides the former
        // independently from a higher-ordinal config source (env var, system property, a mounted
        // application.properties, ...). Comparing the resolved value catches that regardless of
        // which source produced it, rather than checking one specific transliteration by name.
        if (tenantEnabled != securityConfig.enabled()) {
            throw new IllegalStateException(String.format(
                    "quarkus.oidc.tenant-enabled resolved to %s, which disagrees with "
                            + "conductor.security.enabled=%s. quarkus.oidc.tenant-enabled is derived from "
                            + "conductor.security.enabled and must not be configured independently.",
                    tenantEnabled, securityConfig.enabled()));
        }
    }

    private void checkRoleMappings(List<String> failures) {
        Set<String> seenRoles = new HashSet<>();
        for (SecurityConfigGroup.RoleMapping mapping : securityConfig.roleMappings()) {
            if (!seenRoles.add(mapping.role())) {
                failures.add("conductor.security.role-mappings declares role \"" + mapping.role()
                        + "\" more than once.");
            }
            for (String permissionId : mapping.permissions()) {
                if ("*".equals(permissionId) || Permission.byId(permissionId).isPresent()) {
                    continue;
                }
                failures.add("conductor.security.role-mappings: role \"" + mapping.role()
                        + "\" names unknown permission \"" + permissionId + "\". Valid permissions: "
                        + Permission.all().stream().map(Permission::id).collect(Collectors.joining(", ")));
            }
        }
    }
}
