/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.debezium.doc.FixFor;
import io.debezium.platform.config.SecurityConfigGroup;

@ExtendWith(MockitoExtension.class)
class IamAuthorizationControllerTest {

    @Mock
    SecurityConfigGroup config;

    @Test
    @FixFor("debezium/dbz#3003")
    void authorizationEnabledWhenIamEnabled() {
        when(config.enabled()).thenReturn(true);

        assertThat(new IamAuthorizationController(config).isAuthorizationEnabled()).isTrue();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void authorizationDisabledWhenIamDisabled() {
        when(config.enabled()).thenReturn(false);

        assertThat(new IamAuthorizationController(config).isAuthorizationEnabled()).isFalse();
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void readsTheSamePropertyAsAuthentication() {
        // Guards against reintroducing a second, independent flag: this bean is the single
        // kill switch for both enforcement layers, and must read conductor.security.enabled
        // exactly once per call, through SecurityConfigGroup#enabled(), not a dedicated property.
        when(config.enabled()).thenReturn(true);

        new IamAuthorizationController(config).isAuthorizationEnabled();

        verify(config).enabled();
    }
}
