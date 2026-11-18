/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import io.debezium.doc.FixFor;

class PermissionTest {

    @Test
    @FixFor("debezium/dbz#3003")
    void idRendersResourceColonAction() {
        assertThat(Permission.SOURCE_READ.id()).isEqualTo("source:read");
    }

    @ParameterizedTest
    @EnumSource(Permission.class)
    @FixFor("debezium/dbz#3003")
    void byIdResolvesEveryConstant(Permission permission) {
        assertThat(Permission.byId(permission.id())).contains(permission);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void byIdReturnsEmptyForUnknown() {
        assertThat(Permission.byId("source:raed")).isEqualTo(Optional.empty());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void byIdIsCaseSensitive() {
        assertThat(Permission.byId("SOURCE:READ")).isEmpty();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void allContainsEighteenPermissions() {
        // 9 resources: source/destination/transform/connection/vault (read+write, 2 each = 10),
        // pipeline (read/write/operate/logs = 4), monitoring (read = 1), alert (read+write = 2),
        // catalog (read = 1). Total 18. The IAM design's prose says "17 permissions over 9
        // resources", but its own catalogue table sums to 18; this asserts against the table,
        // which is what the role bundles and endpoint assignments are actually built from.
        assertThat(Permission.all()).hasSize(18);
    }

    @ParameterizedTest
    @EnumSource(Permission.class)
    @FixFor("debezium/dbz#3003")
    void resourceAndActionNeverBlank(Permission permission) {
        assertThat(permission.resource()).isNotBlank();
        assertThat(permission.action()).isNotBlank();
    }
}
