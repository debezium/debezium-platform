/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import java.util.List;
import java.util.Optional;

import io.quarkus.arc.Unremovable;
import io.quarkus.runtime.annotations.ConfigPhase;
import io.quarkus.runtime.annotations.ConfigRoot;
import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.smallrye.config.WithName;

/**
 * The single IAM switch (debezium/dbz#3003) and everything it governs: authentication, via the
 * derived {@code quarkus.oidc.tenant-enabled}, authorization, and the internal callback
 * credential. Nothing here is independently switchable; {@code enabled} is the one property an
 * operator sets.
 *
 * <p>{@code @Unremovable}: this is injected from several places, some of them only reachable
 * through CDI proxies that Arc's dead-code elimination cannot always see through; keeping the
 * bean unconditionally avoids depending on that analysis being exhaustive.
 */
@Unremovable
@ConfigMapping(prefix = "conductor.security")
@ConfigRoot(phase = ConfigPhase.RUN_TIME)
public interface SecurityConfigGroup {

    @WithDefault("false")
    boolean enabled();

    /**
     * Role name to permission bundle. A list of {@code {role, permissions}}, never a map: role
     * names must match identity-provider claim values byte-for-byte, and a map key rendered
     * through the Helm chart's env-var transformation would mangle one silently (e.g.
     * {@code dmp-editor} becomes {@code DMP_EDITOR}, matching nothing). Empty means the shipped
     * default bundles apply; see {@code DefaultRoleMappings}.
     */
    @WithName("role-mappings")
    List<RoleMapping> roleMappings();

    @WithName("internal-credential")
    InternalCredentialConfigGroup internalCredential();

    /**
     * A role that is always granted every permission, evaluated ahead of the role-mapping
     * lookup. The recovery path for a deployment whose mapping is wrong, or whose directory
     * emits a role nobody has mapped yet.
     */
    @WithName("bootstrap-admin-role")
    Optional<String> bootstrapAdminRole();

    interface RoleMapping {

        String role();

        List<String> permissions();
    }

    interface InternalCredentialConfigGroup {

        Optional<String> secret();

        @WithName("previous-secret")
        Optional<String> previousSecret();
    }
}
