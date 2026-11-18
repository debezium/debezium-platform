/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import java.util.Collections;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * The shipped default role bundles, used when a deployment configures no
 * {@code conductor.security.role-mappings} of its own (debezium/dbz#3003).
 *
 * <p>Deliberately code, not YAML: the bundles are a list of {@code {role, permissions}} in
 * {@code application.yml} would be indexed config, and SmallRye merges indexed list entries
 * per index across config sources, so a deployment overriding two of the four shipped mappings
 * would end up with a silent hybrid of its own values and the shipped ones rather than cleanly
 * replacing the defaults. Falling back to a code-defined default only when configuration
 * supplies none avoids that trap entirely.
 *
 * <p>Mirrors the default bundles in the platform IAM requirements (role catalogue, default
 * bundles table): {@code dmp-operator} may restart a pipeline and trigger a snapshot but holds
 * no {@code :write}, which is the reason a permission model exists at all.
 */
public final class DefaultRoleMappings {

    public static final String ADMIN = "dmp-admin";
    public static final String EDITOR = "dmp-editor";
    public static final String OPERATOR = "dmp-operator";
    public static final String VIEWER = "dmp-viewer";

    private static final Set<Permission> ALL_READS = Collections.unmodifiableSet(EnumSet.of(
            Permission.SOURCE_READ,
            Permission.DESTINATION_READ,
            Permission.TRANSFORM_READ,
            Permission.CONNECTION_READ,
            Permission.VAULT_READ,
            Permission.PIPELINE_READ,
            Permission.MONITORING_READ,
            Permission.ALERT_READ,
            Permission.CATALOG_READ));

    private DefaultRoleMappings() {
    }

    public static Map<String, Set<Permission>> bundles() {
        Map<String, Set<Permission>> bundles = new LinkedHashMap<>();
        bundles.put(ADMIN, Permission.all());
        bundles.put(EDITOR, editor());
        bundles.put(OPERATOR, operator());
        bundles.put(VIEWER, viewer());
        return Collections.unmodifiableMap(bundles);
    }

    /**
     * All {@code :read} permissions (including {@code vault:read}) plus every write-like action
     * short of touching vaults or alert channels, both of which carry outbound credentials.
     */
    private static Set<Permission> editor() {
        Set<Permission> permissions = EnumSet.copyOf(ALL_READS);
        permissions.addAll(EnumSet.of(
                Permission.SOURCE_WRITE,
                Permission.DESTINATION_WRITE,
                Permission.TRANSFORM_WRITE,
                Permission.CONNECTION_WRITE,
                Permission.PIPELINE_WRITE,
                Permission.PIPELINE_OPERATE,
                Permission.PIPELINE_LOGS));
        return Collections.unmodifiableSet(permissions);
    }

    /**
     * Day-two operations: restart a pipeline, trigger a snapshot, read logs, with no ability to
     * change any configuration and no vault access.
     */
    private static Set<Permission> operator() {
        Set<Permission> permissions = EnumSet.copyOf(viewer());
        permissions.addAll(EnumSet.of(Permission.PIPELINE_OPERATE, Permission.PIPELINE_LOGS));
        return Collections.unmodifiableSet(permissions);
    }

    /**
     * Observe only. Every {@code :read} permission except {@code vault:read}.
     */
    private static Set<Permission> viewer() {
        Set<Permission> permissions = EnumSet.copyOf(ALL_READS);
        permissions.remove(Permission.VAULT_READ);
        return Collections.unmodifiableSet(permissions);
    }
}
