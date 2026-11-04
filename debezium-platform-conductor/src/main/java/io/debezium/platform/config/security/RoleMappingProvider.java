/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import java.util.Set;

/**
 * Resolves the role names present on an identity into the permissions they grant
 * (debezium/dbz#3003).
 *
 * <p>The seam that keeps a future database-backed role mapping additive: a
 * {@code DatabaseRoleMappingProvider} would slot in here without touching
 * {@link PermissionAugmentor}, the permission catalogue, or any annotation.
 */
public interface RoleMappingProvider {

    Set<Permission> permissionsFor(Set<String> roles);
}
