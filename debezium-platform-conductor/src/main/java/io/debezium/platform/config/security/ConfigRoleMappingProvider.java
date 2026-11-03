/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

import io.debezium.platform.config.SecurityConfigGroup;

/**
 * Resolves roles to permissions from {@code conductor.security.role-mappings}, falling back to
 * {@link DefaultRoleMappings} when none is configured (debezium/dbz#3003).
 *
 * <p>The map is resolved once at startup and never mutated afterward: the request path is a hash
 * lookup per role, no parsing and no I/O. Roles present in the token but absent from the mapping
 * contribute nothing and are not an error; organisations have roles unrelated to this platform.
 *
 * <p>Permission names here are expected to already be valid: {@code EnforcementValidator} fails
 * the boot when a configured mapping names an unknown permission, so this class treats an
 * unparseable id defensively (skipped, not thrown) rather than as the primary guard.
 */
@ApplicationScoped
public class ConfigRoleMappingProvider implements RoleMappingProvider {

    private static final String WILDCARD = "*";

    private final Logger logger;
    private final SecurityConfigGroup config;

    private Map<String, Set<Permission>> byRole;
    private Optional<String> bootstrapAdminRole;

    public ConfigRoleMappingProvider(Logger logger, SecurityConfigGroup config) {
        this.logger = logger;
        this.config = config;
    }

    @PostConstruct
    void init() {
        List<SecurityConfigGroup.RoleMapping> configured = config.roleMappings();

        if (configured.isEmpty()) {
            byRole = DefaultRoleMappings.bundles();
            logger.infov("No conductor.security.role-mappings configured; using the {0} shipped default bundles",
                    byRole.size());
        }
        else {
            Map<String, Set<Permission>> resolved = new HashMap<>();
            for (SecurityConfigGroup.RoleMapping mapping : configured) {
                resolved.put(mapping.role(), expand(mapping.permissions()));
            }
            byRole = Map.copyOf(resolved);
            logger.infov("Using {0} role mappings from conductor.security.role-mappings", byRole.size());
        }

        bootstrapAdminRole = config.bootstrapAdminRole();
    }

    @Override
    public Set<Permission> permissionsFor(Set<String> roles) {
        if (bootstrapAdminRole.filter(roles::contains).isPresent()) {
            return Permission.all();
        }

        return roles.stream()
                .map(byRole::get)
                .filter(Objects::nonNull)
                .flatMap(Set::stream)
                .collect(Collectors.toUnmodifiableSet());
    }

    private static Set<Permission> expand(List<String> permissionIds) {
        if (permissionIds.contains(WILDCARD)) {
            return Permission.all();
        }

        return permissionIds.stream()
                .map(Permission::byId)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(Collectors.toUnmodifiableSet());
    }
}
