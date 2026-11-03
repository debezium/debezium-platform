/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

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
class EnforcementValidatorTest {

    private static final String VALID_ISSUER = "https://auth.contoso.com/realms/dmp";
    private static final String PLACEHOLDER_ISSUER = "https://keycloak.invalid/realms/none";

    @Mock
    SecurityConfigGroup config;

    @Test
    @FixFor("debezium/dbz#3003")
    void failsWhenIssuerUnset() {
        givenEnabled();
        givenNoRoleMappings();

        assertThatThrownBy(() -> newValidator(null, Optional.of("conductor")).onStart(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("quarkus.oidc.auth-server-url");
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void failsWhenIssuerIsPlaceholder() {
        givenEnabled();
        givenNoRoleMappings();

        assertThatThrownBy(() -> newValidator(PLACEHOLDER_ISSUER, Optional.of("conductor")).onStart(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("placeholder");
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void failsWhenAudienceUnset() {
        givenEnabled();
        givenNoRoleMappings();

        assertThatThrownBy(() -> newValidator(VALID_ISSUER, Optional.empty()).onStart(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("quarkus.oidc.token.audience");
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void failsWhenRoleMappingNamesUnknownPermission() {
        givenEnabled();
        givenMappings(mapping("dmp-editor", List.of("source:raed")));

        assertThatThrownBy(() -> newValidator(VALID_ISSUER, Optional.of("conductor")).onStart(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("source:raed")
                .hasMessageContaining("source:read");
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void failsWhenTwoMappingsDeclareSameRole() {
        givenEnabled();
        givenMappings(
                mapping("dmp-editor", List.of("source:read")),
                mapping("dmp-editor", List.of("pipeline:read")));

        assertThatThrownBy(() -> newValidator(VALID_ISSUER, Optional.of("conductor")).onStart(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("dmp-editor")
                .hasMessageContaining("more than once");
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void wildcardRoleMappingNeverFails() {
        givenEnabled();
        givenMappings(mapping("dmp-admin", List.of("*")));

        assertThatCode(() -> newValidator(VALID_ISSUER, Optional.of("conductor")).onStart(null))
                .doesNotThrowAnyException();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void startsCleanlyWhenDisabled() {
        when(config.enabled()).thenReturn(false);

        assertThatCode(() -> newValidator(null, Optional.empty()).onStart(null)).doesNotThrowAnyException();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void startsCleanlyWithAValidConfiguration() {
        givenEnabled();
        givenNoRoleMappings();

        assertThatCode(() -> newValidator(VALID_ISSUER, Optional.of("conductor")).onStart(null))
                .doesNotThrowAnyException();
    }

    private void givenEnabled() {
        when(config.enabled()).thenReturn(true);
        // Computed before the stub call: nesting a when()/thenReturn() pair inside the argument
        // of another confuses Mockito's ongoing-stubbing tracking (UnfinishedStubbingException).
        SecurityConfigGroup.InternalCredentialConfigGroup internalCredential = internalCredential(Optional.of("shhh"));
        when(config.internalCredential()).thenReturn(internalCredential);
    }

    private void givenNoRoleMappings() {
        when(config.roleMappings()).thenReturn(List.of());
    }

    private void givenMappings(SecurityConfigGroup.RoleMapping... mappings) {
        // mappings are fully constructed (each its own complete when()/thenReturn() pair) before
        // this call starts, so there is no nested stubbing underway when it runs.
        when(config.roleMappings()).thenReturn(List.of(mappings));
    }

    private static SecurityConfigGroup.InternalCredentialConfigGroup internalCredential(Optional<String> secret) {
        SecurityConfigGroup.InternalCredentialConfigGroup internalCredential = mock(
                SecurityConfigGroup.InternalCredentialConfigGroup.class);
        when(internalCredential.secret()).thenReturn(secret);
        return internalCredential;
    }

    private static SecurityConfigGroup.RoleMapping mapping(String role, List<String> permissions) {
        SecurityConfigGroup.RoleMapping mapping = mock(SecurityConfigGroup.RoleMapping.class);
        when(mapping.role()).thenReturn(role);
        when(mapping.permissions()).thenReturn(permissions);
        return mapping;
    }

    private EnforcementValidator newValidator(String issuer, Optional<String> audience) {
        return new EnforcementValidator(Logger.getLogger(EnforcementValidatorTest.class), config, issuer, audience);
    }
}
