/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.dto;

import java.util.Set;

/**
 * The response to {@code GET /api/me} (debezium/dbz#3003).
 *
 * <p>{@code iamEnabled} is load-bearing, not informational: with authorization disabled there is
 * no identity and no permission set to report, so a client receiving a bare empty
 * {@code permissions} list could not otherwise tell "IAM is off, everything is permitted" from
 * "you are authenticated but hold no permissions".
 *
 * <p>{@code roles} includes roles present on the token but absent from the role-mapping
 * configuration; that is diagnostic, answering "my token has the role, why can't I do anything?"
 * directly, rather than an omission to fix.
 */
public record IdentityResponse(
        boolean iamEnabled,
        String subject,
        String username,
        String email,
        Set<String> roles,
        Set<String> permissions) {

    public static IdentityResponse disabled() {
        return new IdentityResponse(false, null, null, null, Set.of(), Set.of("*"));
    }
}
