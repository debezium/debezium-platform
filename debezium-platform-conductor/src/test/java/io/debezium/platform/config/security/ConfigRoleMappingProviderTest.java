/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import io.debezium.doc.FixFor;
import io.debezium.platform.config.SecurityConfigGroup;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ConfigRoleMappingProviderTest {

    @Mock
    SecurityConfigGroup config;

    @Test
    @FixFor("debezium/dbz#3003")
    void resolvesSinglePermissionForSingleRole() {
        givenMappings(mapping("dmp-reader", List.of("source:read")));
        givenNoBootstrapRole();

        assertThat(newProvider().permissionsFor(Set.of("dmp-reader")))
                .containsExactly(Permission.SOURCE_READ);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void resolvesUnionAcrossMultipleRoles() {
        givenMappings(
                mapping("role-a", List.of("source:read")),
                mapping("role-b", List.of("pipeline:write")));
        givenNoBootstrapRole();

        assertThat(newProvider().permissionsFor(Set.of("role-a", "role-b")))
                .containsExactlyInAnyOrder(Permission.SOURCE_READ, Permission.PIPELINE_WRITE);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void ignoresRoleAbsentFromMapping() {
        givenMappings(mapping("dmp-editor", List.of("source:read")));
        givenNoBootstrapRole();

        assertThat(newProvider().permissionsFor(Set.of("dmp-editor", "finance-team")))
                .containsExactly(Permission.SOURCE_READ);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void returnsEmptyWhenNoRoleIsMapped() {
        givenMappings(mapping("dmp-editor", List.of("source:read")));
        givenNoBootstrapRole();

        assertThat(newProvider().permissionsFor(Set.of("finance-team"))).isEmpty();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void returnsEmptyForEmptyRoleSet() {
        givenMappings(mapping("dmp-editor", List.of("source:read")));
        givenNoBootstrapRole();

        assertThat(newProvider().permissionsFor(Set.of())).isEmpty();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void bootstrapAdminRoleGrantsAllPermissions() {
        givenMappings(mapping("dmp-editor", List.of("source:read")));
        when(config.bootstrapAdminRole()).thenReturn(Optional.of("platform-engineering"));

        assertThat(newProvider().permissionsFor(Set.of("platform-engineering")))
                .isEqualTo(Permission.all());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void bootstrapAdminRoleShortCircuitsMappingLookup() {
        // The configured mapping for this exact role name would grant only one permission;
        // the bootstrap check runs ahead of that lookup, so the full catalogue wins instead.
        givenMappings(mapping("platform-engineering", List.of("catalog:read")));
        when(config.bootstrapAdminRole()).thenReturn(Optional.of("platform-engineering"));

        assertThat(newProvider().permissionsFor(Set.of("platform-engineering")))
                .isEqualTo(Permission.all());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void wildcardExpandsToAllPermissions() {
        givenMappings(mapping("dmp-admin", List.of("*")));
        givenNoBootstrapRole();

        assertThat(newProvider().permissionsFor(Set.of("dmp-admin"))).isEqualTo(Permission.all());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void mappingIsResolvedOnceAtStartup() {
        givenMappings(mapping("dmp-editor", List.of("source:read")));
        givenNoBootstrapRole();

        ConfigRoleMappingProvider provider = newProvider();
        provider.permissionsFor(Set.of("dmp-editor"));
        provider.permissionsFor(Set.of("dmp-editor"));

        verify(config, times(1)).roleMappings();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void resolvedMappingIsImmutable() {
        givenMappings(mapping("dmp-editor", List.of("source:read")));
        givenNoBootstrapRole();

        Set<Permission> resolved = newProvider().permissionsFor(Set.of("dmp-editor"));

        assertThatThrownBy(() -> resolved.add(Permission.VAULT_WRITE))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void fallsBackToDefaultRoleMappingsWhenConfiguredListIsEmpty() {
        when(config.roleMappings()).thenReturn(List.of());
        givenNoBootstrapRole();

        assertThat(newProvider().permissionsFor(Set.of(DefaultRoleMappings.ADMIN)))
                .isEqualTo(Permission.all());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void configuredMappingsReplaceDefaultsEntirely() {
        givenMappings(mapping("custom-role", List.of("catalog:read")));
        givenNoBootstrapRole();

        // dmp-admin only means something in the shipped defaults; once configuration
        // supplies its own mappings, the defaults do not linger alongside them.
        assertThat(newProvider().permissionsFor(Set.of(DefaultRoleMappings.ADMIN))).isEmpty();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void unknownPermissionIdInConfigurationIsSkippedNotThrown() {
        givenMappings(mapping("dmp-editor", List.of("source:raed", "source:read")));
        givenNoBootstrapRole();

        assertThat(newProvider().permissionsFor(Set.of("dmp-editor")))
                .containsExactly(Permission.SOURCE_READ);
    }

    private void givenMappings(SecurityConfigGroup.RoleMapping... mappings) {
        when(config.roleMappings()).thenReturn(List.of(mappings));
    }

    private void givenNoBootstrapRole() {
        when(config.bootstrapAdminRole()).thenReturn(Optional.empty());
    }

    private static SecurityConfigGroup.RoleMapping mapping(String role, List<String> permissions) {
        SecurityConfigGroup.RoleMapping mapping = mock(SecurityConfigGroup.RoleMapping.class);
        when(mapping.role()).thenReturn(role);
        when(mapping.permissions()).thenReturn(permissions);
        return mapping;
    }

    private ConfigRoleMappingProvider newProvider() {
        ConfigRoleMappingProvider provider = new ConfigRoleMappingProvider(
                Logger.getLogger(ConfigRoleMappingProviderTest.class), config);
        provider.init();
        return provider;
    }
}
