/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;

import io.debezium.platform.config.SecurityConfigGroup;
import io.quarkus.security.StringPermission;
import io.quarkus.security.identity.AuthenticationRequestContext;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.identity.SecurityIdentityAugmentor;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;
import io.smallrye.mutiny.Uni;

/**
 * Resolves the role names on a validated {@link SecurityIdentity} into the permission set
 * endpoints are gated on (debezium/dbz#3003). Runs after {@code quarkus-oidc} has validated the
 * token and produced the identity.
 *
 * <p>Plays no part in disabled mode: with IAM off this is a pass-through, and the absence of
 * enforcement is handled entirely by {@link IamAuthorizationController} skipping the checks,
 * never by synthesising a permission-bearing identity here.
 */
@ApplicationScoped
public class PermissionAugmentor implements SecurityIdentityAugmentor {

    /** Identity attribute carrying the resolved {@link Permission} set, read by {@code /api/me}. */
    public static final String PERMISSIONS_ATTRIBUTE = "io.debezium.platform.permissions";

    private final RoleMappingProvider roleMappingProvider;
    private final SecurityConfigGroup config;

    /**
     * Resolving a role set to permissions is a pure function of {@code conductor.security.role-mappings},
     * which is fixed at startup, so the result for a given role combination never changes; the key
     * space is bounded by the number of distinct role combinations an identity provider actually
     * issues. Caching avoids re-grouping permissions into {@link StringPermission}s on every
     * authenticated request.
     */
    private final Map<Set<String>, Resolved> resolvedByRoles = new ConcurrentHashMap<>();

    public PermissionAugmentor(RoleMappingProvider roleMappingProvider, SecurityConfigGroup config) {
        this.roleMappingProvider = roleMappingProvider;
        this.config = config;
    }

    @Override
    public Uni<SecurityIdentity> augment(SecurityIdentity identity, AuthenticationRequestContext context) {
        if (!config.enabled() || identity.isAnonymous()) {
            return Uni.createFrom().item(identity);
        }

        Resolved resolved = resolvedByRoles.computeIfAbsent(identity.getRoles(), this::resolve);

        QuarkusSecurityIdentity.Builder builder = QuarkusSecurityIdentity.builder(identity);
        resolved.stringPermissions().forEach(builder::addPermission);
        builder.addAttribute(PERMISSIONS_ATTRIBUTE, resolved.permissions());

        return Uni.createFrom().item(builder.build());
    }

    private Resolved resolve(Set<String> roles) {
        Set<Permission> granted = roleMappingProvider.permissionsFor(roles);
        return new Resolved(granted, toStringPermissions(granted));
    }

    private record Resolved(Set<Permission> permissions, Collection<StringPermission> stringPermissions) {
    }

    /**
     * Groups permissions by resource so one {@link StringPermission} carries every action
     * granted for it, rather than allocating one object per permission string. Package-visible
     * so {@code PermissionAugmentorTest} can assert the grouping directly.
     */
    static Collection<StringPermission> toStringPermissions(Set<Permission> granted) {
        Map<String, List<String>> actionsByResource = granted.stream()
                .collect(Collectors.groupingBy(Permission::resource,
                        Collectors.mapping(Permission::action, Collectors.toList())));

        return actionsByResource.entrySet().stream()
                .map(entry -> new StringPermission(entry.getKey(), entry.getValue().toArray(new String[0])))
                .collect(Collectors.toList());
    }
}
