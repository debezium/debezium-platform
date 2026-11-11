/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Optional;

import org.eclipse.microprofile.jwt.JsonWebToken;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import io.quarkus.security.identity.SecurityIdentity;

class EmailAllowlistTest {

    @TempDir
    Path dir;

    @Test
    void namedProviderWithoutAllowlistAllowsEveryAuthenticatedUser() {
        var allowlist = new EmailAllowlist(true, Optional.of("google"), Optional.empty());

        assertThat(allowlist.denyReason(identity(Map.of("email", "anyone@gmail.com")))).isNull();
    }

    @Test
    void customIssuerWithoutAllowlistAllowsEveryAuthenticatedUser() {
        var allowlist = new EmailAllowlist(true, Optional.empty(), Optional.of(" "));

        assertThat(allowlist.denyReason(identity(Map.of()))).isNull();
    }

    @Test
    void configuredButMissingFileAllowsEveryAuthenticatedUser() {
        var allowlist = new EmailAllowlist(true, Optional.of("google"), Optional.of(dir.resolve("nope.yml").toString()));

        assertThat(allowlist.denyReason(identity(Map.of()))).isNull();
    }

    @Test
    void emptyFileAllowsEveryAuthenticatedUser() throws IOException {
        var allowlist = new EmailAllowlist(true, Optional.of("google"), Optional.of(file("# nobody listed yet\n")));

        assertThat(allowlist.denyReason(identity(Map.of()))).isNull();
    }

    @Test
    void invalidFileFailsStartup() throws IOException {
        assertThatThrownBy(() -> new EmailAllowlist(true, Optional.of("google"), Optional.of(file("users: [unclosed"))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void oidcDisabledIgnoresEverything() {
        var allowlist = new EmailAllowlist(false, Optional.of("google"), Optional.empty());

        assertThat(allowlist.denyReason(identity(Map.of()))).isNull();
    }

    @Test
    void matchesVerifiedEmailCaseInsensitivelyAndIgnoresUnknownFields() throws IOException {
        var allowlist = new EmailAllowlist(true, Optional.of("google"), Optional.of(file("""
                # comment
                users:
                  - email: Alice@Example.com
                    roles: [future-use]
                  - email: bob@example.com
                """)));

        assertThat(allowlist.denyReason(identity(Map.of("email", "alice@EXAMPLE.com", "email_verified", true)))).isNull();
        assertThat(allowlist.denyReason(identity(Map.of("email", "eve@example.com", "email_verified", true))))
                .isEqualTo("not_in_allowlist");
        assertThat(allowlist.denyReason(identity(Map.of("email", "bob@example.com", "email_verified", false))))
                .isEqualTo("email_not_verified");
        assertThat(allowlist.denyReason(identity(Map.of("email_verified", true)))).isEqualTo("not_in_allowlist");
    }

    @Test
    void emptyUserListAllowsEveryAuthenticatedUser() throws IOException {
        var allowlist = new EmailAllowlist(true, Optional.of("google"), Optional.of(file("users: []")));

        assertThat(allowlist.denyReason(identity(Map.of("email", "eve@example.com", "email_verified", true)))).isNull();
    }

    @Test
    void auditUserIsEmailThenPrincipalNameThenAnonymous() {
        assertThat(EmailAllowlist.user(identity(Map.of("email", "alice@example.com")))).isEqualTo("alice@example.com");
        assertThat(EmailAllowlist.user(identity(Map.of()))).isEqualTo("alice");
        SecurityIdentity anonymous = mock(SecurityIdentity.class);
        when(anonymous.isAnonymous()).thenReturn(true);
        assertThat(EmailAllowlist.user(anonymous)).isEqualTo("anonymous");
    }

    private String file(String content) throws IOException {
        return Files.writeString(dir.resolve("allowlist.yml"), content).toString();
    }

    private static SecurityIdentity identity(Map<String, Object> claims) {
        JsonWebToken jwt = mock(JsonWebToken.class);
        when(jwt.getName()).thenReturn("alice");
        claims.forEach((k, v) -> {
            when(jwt.containsClaim(k)).thenReturn(true);
            when(jwt.getClaim(k)).thenReturn(v);
        });
        SecurityIdentity identity = mock(SecurityIdentity.class);
        when(identity.getPrincipal()).thenReturn(jwt);
        return identity;
    }
}
