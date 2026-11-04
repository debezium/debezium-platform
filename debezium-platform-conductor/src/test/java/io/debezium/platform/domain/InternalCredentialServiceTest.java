/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.util.NoSuchElementException;
import java.util.Optional;

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
class InternalCredentialServiceTest {

    @Mock
    SecurityConfigGroup config;

    @Mock
    SecurityConfigGroup.InternalCredentialConfigGroup internalCredential;

    private InternalCredentialService service;

    private void givenSecrets(Optional<String> current, Optional<String> previous) {
        when(config.internalCredential()).thenReturn(internalCredential);
        when(internalCredential.secret()).thenReturn(current);
        when(internalCredential.previousSecret()).thenReturn(previous);
        service = new InternalCredentialService(config);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void isConfiguredReflectsWhetherASecretIsPresent() {
        givenSecrets(Optional.empty(), Optional.empty());
        assertThat(service.isConfigured()).isFalse();

        givenSecrets(Optional.of("secret-a"), Optional.empty());
        assertThat(service.isConfigured()).isTrue();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void enforcementActiveOnlyWhenSecretConfiguredAndIamEnabled() {
        // No secret: enforcement is never active, regardless of the IAM switch.
        givenSecrets(Optional.empty(), Optional.empty());
        when(config.enabled()).thenReturn(false);
        assertThat(service.isEnforcementActive()).isFalse();
        when(config.enabled()).thenReturn(true);
        assertThat(service.isEnforcementActive()).isFalse();

        // Secret configured but IAM still disabled: the DDD-79 upgrade window where every
        // pipeline is being redeployed to carry the credential before enforcement switches on.
        // Must stay inactive, or a not-yet-redeployed pipeline's notifications are rejected.
        givenSecrets(Optional.of("secret-a"), Optional.empty());
        when(config.enabled()).thenReturn(false);
        assertThat(service.isEnforcementActive()).isFalse();

        // Secret configured and IAM enabled: real verification applies.
        when(config.enabled()).thenReturn(true);
        assertThat(service.isEnforcementActive()).isTrue();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void mintThenVerifySucceeds() {
        givenSecrets(Optional.of("secret-a"), Optional.empty());

        String credential = service.mint(42L);

        assertThat(service.verify(42L, credential)).isTrue();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void mintIsDeterministic() {
        givenSecrets(Optional.of("secret-a"), Optional.empty());

        assertThat(service.mint(42L)).isEqualTo(service.mint(42L));
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void mintDiffersPerPipeline() {
        givenSecrets(Optional.of("secret-a"), Optional.empty());

        assertThat(service.mint(42L)).isNotEqualTo(service.mint(43L));
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void rejectsCredentialMintedForAnotherPipeline() {
        givenSecrets(Optional.of("secret-a"), Optional.empty());

        String credentialForPipeline42 = service.mint(42L);

        assertThat(service.verify(43L, credentialForPipeline42)).isFalse();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void rejectsEmptyCredential() {
        givenSecrets(Optional.of("secret-a"), Optional.empty());

        assertThat(service.verify(42L, "")).isFalse();
        assertThat(service.verify(42L, null)).isFalse();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void rejectsMalformedBase64() {
        givenSecrets(Optional.of("secret-a"), Optional.empty());

        assertThat(service.verify(42L, "not-a-valid-credential-at-all")).isFalse();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void credentialIsUrlSafeBase64WithoutPadding() {
        givenSecrets(Optional.of("secret-a"), Optional.empty());

        String credential = service.mint(42L);

        assertThat(credential).doesNotContain("+", "/", "=");
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void mintThrowsWhenSecretUnconfigured() {
        givenSecrets(Optional.empty(), Optional.empty());

        assertThatThrownBy(() -> service.mint(42L)).isInstanceOf(NoSuchElementException.class);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void verifyAcceptsCredentialFromPreviousSecret() {
        givenSecrets(Optional.of("secret-a"), Optional.empty());
        String credentialFromA = service.mint(42L);

        givenSecrets(Optional.of("secret-b"), Optional.of("secret-a"));

        assertThat(service.verify(42L, credentialFromA)).isTrue();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void verifyRejectsPreviousSecretOnceRemoved() {
        givenSecrets(Optional.of("secret-a"), Optional.empty());
        String credentialFromA = service.mint(42L);

        givenSecrets(Optional.of("secret-b"), Optional.empty());

        assertThat(service.verify(42L, credentialFromA)).isFalse();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void mintAlwaysUsesCurrentSecret() {
        givenSecrets(Optional.of("secret-b"), Optional.of("secret-a"));

        String minted = service.mint(42L);

        givenSecrets(Optional.of("secret-a"), Optional.empty());
        String fromOldSecretOnly = service.mint(42L);

        assertThat(minted).isNotEqualTo(fromOldSecretOnly);
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void usesConstantTimeComparison() {
        // Behavioural proxy for "uses MessageDigest.isEqual": a credential differing only in its
        // last character must still be rejected cleanly, not throw or short-circuit oddly.
        givenSecrets(Optional.of("secret-a"), Optional.empty());
        String credential = service.mint(42L);
        String almostCorrect = credential.substring(0, credential.length() - 1)
                + (credential.charAt(credential.length() - 1) == 'a' ? 'b' : 'a');

        assertThat(service.verify(42L, almostCorrect)).isFalse();
    }
}
