/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config.security;

import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import jakarta.interceptor.Interceptor;

import io.debezium.platform.config.SecurityConfigGroup;
import io.quarkus.security.spi.runtime.AuthorizationController;

/**
 * The single kill switch for both enforcement layers (debezium/dbz#3003): Quarkus consults this
 * SPI from {@code AbstractHttpAuthorizer} (the {@code quarkus.http.auth.permission.*} path
 * policies) and from every annotation interceptor ({@code @PermissionsAllowed},
 * {@code @RolesAllowed}, {@code @Authenticated}, {@code @DenyAll}, {@code @PermitAll}), as well as
 * the eager JAX-RS security path.
 *
 * <p>It reads the same {@code conductor.security.enabled} property as authentication. A
 * dedicated flag here, as in the Quarkus documentation's own example, would create a second
 * switch able to disagree with the first, which is exactly the partial-enforcement state this
 * design forbids.
 */
@Alternative
@Priority(Interceptor.Priority.LIBRARY_AFTER)
@ApplicationScoped
public class IamAuthorizationController extends AuthorizationController {

    private final SecurityConfigGroup config;

    public IamAuthorizationController(SecurityConfigGroup config) {
        this.config = config;
    }

    @Override
    public boolean isAuthorizationEnabled() {
        return config.enabled();
    }
}
