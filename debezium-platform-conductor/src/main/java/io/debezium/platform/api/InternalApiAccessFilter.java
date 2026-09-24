/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;

import org.jboss.logging.Logger;

/**
 * Blocks external access to the internal endpoints mounted under {@code /api/internal/*} (DDD-68). These
 * are meant to be called only in-cluster by Debezium Server, which posts snapshot notifications straight
 * to the conductor {@code Service} DNS and therefore does not traverse any proxy.
 * <p>
 * A request that reaches an internal endpoint carrying proxy-forwarding headers ({@code X-Forwarded-For}
 * or {@code Forwarded}) necessarily transited an ingress/reverse proxy, i.e. it did not originate from a
 * direct in-cluster {@code Service} call, and is rejected with {@code 403}. This is a controller-agnostic
 * replacement for an ingress-specific deny rule: it holds for any ingress controller (or none) because it
 * is enforced in the application, and it is always on (there is no opt-out). It is not a substitute for
 * network-level controls (e.g. a {@code NetworkPolicy}) when the conductor is exposed directly, bypassing
 * every proxy.
 */
@Provider
@Priority(Priorities.AUTHORIZATION)
public class InternalApiAccessFilter implements ContainerRequestFilter {

    static final String INTERNAL_PATH_PREFIX = "internal/";
    private static final String X_FORWARDED_FOR = "X-Forwarded-For";
    private static final String FORWARDED = "Forwarded";

    private final Logger logger;

    public InternalApiAccessFilter(Logger logger) {
        this.logger = logger;
    }

    @Override
    public void filter(ContainerRequestContext requestContext) {
        if (!isInternalPath(requestContext.getUriInfo().getPath())) {
            return;
        }
        if (cameThroughProxy(requestContext)) {
            logger.warnf("Rejected external request to internal endpoint '%s': proxy-forwarding headers present, "
                    + "internal endpoints are reachable only via the in-cluster conductor Service", requestContext.getUriInfo().getPath());
            requestContext.abortWith(Response.status(Response.Status.FORBIDDEN).build());
        }
    }

    private static boolean isInternalPath(String path) {
        if (path == null) {
            return false;
        }
        String normalized = path.startsWith("/") ? path.substring(1) : path;
        return normalized.startsWith(INTERNAL_PATH_PREFIX);
    }

    private static boolean cameThroughProxy(ContainerRequestContext requestContext) {
        return requestContext.getHeaderString(X_FORWARDED_FOR) != null
                || requestContext.getHeaderString(FORWARDED) != null;
    }
}
