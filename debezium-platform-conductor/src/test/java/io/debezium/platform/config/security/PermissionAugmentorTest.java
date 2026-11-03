/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.security.Principal;
import java.util.Collection;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import io.debezium.doc.FixFor;
import io.debezium.platform.config.SecurityConfigGroup;
import io.quarkus.security.StringPermission;
import io.quarkus.security.identity.AuthenticationRequestContext;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.security.runtime.QuarkusSecurityIdentity;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PermissionAugmentorTest {

    @Mock
    RoleMappingProvider roleMappingProvider;

    @Mock
    SecurityConfigGroup config;

    private final AuthenticationRequestContext context = mock(AuthenticationRequestContext.class);

    @Test
    @FixFor("debezium/dbz#3003")
    void attachesResolvedPermissionsToIdentity() {
        when(config.enabled()).thenReturn(true);
        when(roleMappingProvider.permissionsFor(Set.of("dmp-viewer"))).thenReturn(Set.of(Permission.SOURCE_READ));

        SecurityIdentity augmented = augment(identityWithRoles("dmp-viewer"));

        assertThat(checkPermission(augmented, "source", "read")).isTrue();
        assertThat(checkPermission(augmented, "source", "write")).isFalse();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void groupsPermissionsByResource() {
        // The IAM design's narrative example claims "an identity with the editor bundle holds 6
        // permission objects rather than 16", but the editor bundle it defines (requirements
        // §4.3: all :read, plus 7 write-like actions) spans all 9 resources in the catalogue, 16
        // permissions over 9 resources, not 6; this asserts the grouping behaviour is correct
        // against the actual shipped bundle rather than the doc's inconsistent illustration.
        Set<Permission> editorPermissions = DefaultRoleMappings.bundles().get(DefaultRoleMappings.EDITOR);
        assertThat(editorPermissions).hasSize(16);

        Collection<StringPermission> grouped = PermissionAugmentor.toStringPermissions(editorPermissions);

        assertThat(grouped).hasSize(9);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void groupingAllocatesOnePermissionObjectPerResourceNotPerAction() {
        Set<Permission> fourActionsTwoResources = Set.of(
                Permission.SOURCE_READ, Permission.SOURCE_WRITE,
                Permission.PIPELINE_READ, Permission.PIPELINE_WRITE,
                Permission.PIPELINE_OPERATE, Permission.PIPELINE_LOGS);

        Collection<StringPermission> grouped = PermissionAugmentor.toStringPermissions(fourActionsTwoResources);

        assertThat(grouped).hasSize(2);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void storesResolvedSetAsIdentityAttribute() {
        when(config.enabled()).thenReturn(true);
        Set<Permission> granted = Set.of(Permission.PIPELINE_READ, Permission.PIPELINE_OPERATE);
        when(roleMappingProvider.permissionsFor(Set.of("dmp-operator"))).thenReturn(granted);

        SecurityIdentity augmented = augment(identityWithRoles("dmp-operator"));

        Object attribute = augmented.getAttribute(PermissionAugmentor.PERMISSIONS_ATTRIBUTE);
        assertThat(attribute).isEqualTo(granted);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void returnsIdentityUnchangedWhenDisabled() {
        when(config.enabled()).thenReturn(false);
        SecurityIdentity identity = identityWithRoles("dmp-admin");

        assertThat(augment(identity)).isSameAs(identity);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void returnsIdentityUnchangedForAnonymous() {
        when(config.enabled()).thenReturn(true);
        SecurityIdentity anonymous = QuarkusSecurityIdentity.builder().setAnonymous(true).build();

        assertThat(augment(anonymous)).isSameAs(anonymous);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void rolesWithNoMappingAreNotAddedAsPermissions() {
        when(config.enabled()).thenReturn(true);
        when(roleMappingProvider.permissionsFor(Set.of("finance-team"))).thenReturn(Set.of());

        SecurityIdentity augmented = augment(identityWithRoles("finance-team"));

        assertThat(checkPermission(augmented, "source", "read")).isFalse();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void emptyPermissionSetProducesValidIdentity() {
        when(config.enabled()).thenReturn(true);
        when(roleMappingProvider.permissionsFor(Set.of("finance-team"))).thenReturn(Set.of());

        SecurityIdentity augmented = augment(identityWithRoles("finance-team"));

        assertThat(augmented.isAnonymous()).isFalse();
        Object attribute = augmented.getAttribute(PermissionAugmentor.PERMISSIONS_ATTRIBUTE);
        assertThat(attribute).isEqualTo(Set.of());
    }

    private SecurityIdentity augment(SecurityIdentity identity) {
        return new PermissionAugmentor(roleMappingProvider, config)
                .augment(identity, context)
                .await().indefinitely();
    }

    private static boolean checkPermission(SecurityIdentity identity, String resource, String action) {
        return identity.checkPermission(new StringPermission(resource, action)).await().indefinitely();
    }

    private static QuarkusSecurityIdentity identityWithRoles(String... roles) {
        QuarkusSecurityIdentity.Builder builder = QuarkusSecurityIdentity.builder()
                .setPrincipal(principal("alice"));
        for (String role : roles) {
            builder.addRole(role);
        }
        return builder.build();
    }

    private static Principal principal(String name) {
        return () -> name;
    }
}
