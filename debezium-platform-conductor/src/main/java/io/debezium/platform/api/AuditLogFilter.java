/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.debezium.platform.security.EmailAllowlist.AUDIT;

import java.util.Set;

import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;

import io.debezium.platform.security.EmailAllowlist;
import io.quarkus.security.identity.SecurityIdentity;

/**
 * Writes one audit line per mutating API call to the {@code io.debezium.platform.audit} logger. Request bodies are
 * never logged: source/destination configs carry credentials. Reads are not logged.
 */
@Provider
public class AuditLogFilter implements ContainerResponseFilter {

    private static final Set<String> MUTATING = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final SecurityIdentity identity;

    @Inject
    public AuditLogFilter(SecurityIdentity identity) {
        this.identity = identity;
    }

    @Override
    public void filter(ContainerRequestContext request, ContainerResponseContext response) {
        if (MUTATING.contains(request.getMethod())) {
            AUDIT.infof("AUDIT user=%s action=%s path=%s status=%d", EmailAllowlist.user(identity), request.getMethod(),
                    request.getUriInfo().getRequestUri().getRawPath(), response.getStatus());
        }
    }
}
