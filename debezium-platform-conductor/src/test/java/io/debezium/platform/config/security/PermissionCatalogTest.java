/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;

import io.debezium.doc.FixFor;

/**
 * Keeps {@link Permissions} (the compile-time constants {@code @PermissionsAllowed} needs) and
 * {@link Permission} (the enum) from drifting apart (debezium/dbz#3003).
 */
class PermissionCatalogTest {

    @Test
    @FixFor("debezium/dbz#3003")
    void everyConstantParsesToAPermission() throws IllegalAccessException {
        for (String id : permissionsConstants()) {
            assertThat(Permission.byId(id)).as("Permissions constant \"%s\"", id).isPresent();
        }
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void everyEnumValueHasAConstant() throws IllegalAccessException {
        Set<String> constantIds = Set.copyOf(permissionsConstants());

        List<String> missing = new ArrayList<>();
        for (Permission permission : Permission.values()) {
            if (!constantIds.contains(permission.id())) {
                missing.add(permission.id());
            }
        }

        assertThat(missing).as("Permission values with no matching Permissions constant").isEmpty();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void constantValuesMatchEnumIds() throws IllegalAccessException {
        Set<String> enumIds = Permission.all().stream().map(Permission::id).collect(Collectors.toUnmodifiableSet());

        assertThat(Set.copyOf(permissionsConstants())).isEqualTo(enumIds);
    }

    private static List<String> permissionsConstants() throws IllegalAccessException {
        List<String> ids = new ArrayList<>();
        for (Field field : Permissions.class.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers()) && field.getType() == String.class) {
                ids.add((String) field.get(null));
            }
        }
        return ids;
    }
}
