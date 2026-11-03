/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import java.util.Arrays;
import java.util.Collections;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;

/**
 * The closed catalogue of permission names the platform authorizes against (debezium/dbz#3003).
 *
 * <p>Quarkus parses {@code @PermissionsAllowed("source:read")} as permission name {@code source},
 * action {@code read}, the colon being its native separator rather than a convention invented
 * here. {@link #id()} is therefore both the configuration/wire form and, via {@link Permissions},
 * the string used in annotations.
 *
 * <p>The set is closed deliberately: a typo in configuration is rejected at startup by
 * {@code EnforcementValidator} rather than silently granting nothing, and a typo in an annotation
 * is caught by {@code PermissionCatalogTest}.
 */
public enum Permission {

    SOURCE_READ("source", "read"),
    SOURCE_WRITE("source", "write"),
    DESTINATION_READ("destination", "read"),
    DESTINATION_WRITE("destination", "write"),
    TRANSFORM_READ("transform", "read"),
    TRANSFORM_WRITE("transform", "write"),
    CONNECTION_READ("connection", "read"),
    CONNECTION_WRITE("connection", "write"),
    VAULT_READ("vault", "read"),
    VAULT_WRITE("vault", "write"),
    PIPELINE_READ("pipeline", "read"),
    PIPELINE_WRITE("pipeline", "write"),
    PIPELINE_OPERATE("pipeline", "operate"),
    PIPELINE_LOGS("pipeline", "logs"),
    MONITORING_READ("monitoring", "read"),
    ALERT_READ("alert", "read"),
    ALERT_WRITE("alert", "write"),
    CATALOG_READ("catalog", "read");

    private final String resource;
    private final String action;

    Permission(String resource, String action) {
        this.resource = resource;
        this.action = action;
    }

    public String resource() {
        return resource;
    }

    public String action() {
        return action;
    }

    /**
     * The configuration and wire form, e.g. {@code "source:read"}.
     */
    public String id() {
        return resource + ":" + action;
    }

    public static Optional<Permission> byId(String id) {
        return Arrays.stream(values())
                .filter(permission -> permission.id().equals(id))
                .findFirst();
    }

    public static Set<Permission> all() {
        return Collections.unmodifiableSet(EnumSet.allOf(Permission.class));
    }
}
