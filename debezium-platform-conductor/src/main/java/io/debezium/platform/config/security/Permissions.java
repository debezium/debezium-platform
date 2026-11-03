/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

/**
 * Compile-time string constants mirroring {@link Permission}, for use in
 * {@code @PermissionsAllowed}: annotation values must be compile-time constants, so the enum
 * cannot be referenced directly. {@code PermissionCatalogTest} asserts every constant here
 * parses to a {@link Permission} and that every {@link Permission} has a constant, so the two
 * cannot drift (debezium/dbz#3003).
 */
public final class Permissions {

    public static final String SOURCE_READ = "source:read";
    public static final String SOURCE_WRITE = "source:write";
    public static final String DESTINATION_READ = "destination:read";
    public static final String DESTINATION_WRITE = "destination:write";
    public static final String TRANSFORM_READ = "transform:read";
    public static final String TRANSFORM_WRITE = "transform:write";
    public static final String CONNECTION_READ = "connection:read";
    public static final String CONNECTION_WRITE = "connection:write";
    public static final String VAULT_READ = "vault:read";
    public static final String VAULT_WRITE = "vault:write";
    public static final String PIPELINE_READ = "pipeline:read";
    public static final String PIPELINE_WRITE = "pipeline:write";
    public static final String PIPELINE_OPERATE = "pipeline:operate";
    public static final String PIPELINE_LOGS = "pipeline:logs";
    public static final String MONITORING_READ = "monitoring:read";
    public static final String ALERT_READ = "alert:read";
    public static final String ALERT_WRITE = "alert:write";
    public static final String CATALOG_READ = "catalog:read";

    private Permissions() {
    }
}
