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
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;

import org.jboss.logging.Logger;

import io.debezium.platform.domain.InternalCredentialService;

/**
 * Guards {@code /api/internal/*} (debezium/dbz#3003). Replaces the former
 * {@code InternalApiAccessFilter}: this still carries its proxy-provenance heuristic, but only
 * as a fallback for as long as no internal credential secret is configured.
 *
 * <p><b>Two modes, chosen per request by whether a secret exists, not by the IAM switch:</b>
 * <ul>
 * <li>No {@code conductor.security.internal-credential.secret} configured: falls back to the
 * pre-existing heuristic, rejecting an internal-path request carrying proxy-forwarding headers
 * ({@code X-Forwarded-For} or {@code Forwarded}), since Debezium Server calls the in-cluster
 * Service directly and never traverses a proxy. Unchanged from before this feature, and
 * deliberately not gated on {@code conductor.security.enabled}: it is today's only guard and
 * must not disappear just because IAM has not been enabled yet.</li>
 * <li>A secret is configured: the heuristic is replaced by real verification
 * ({@link InternalCredentialService}) of the pipeline-scoped HMAC credential, and a credential
 * shaped like ours presented at a non-internal path is rejected (FR-33), on the theory that a
 * bearer value in our derived format at a user-facing endpoint is a misuse, not a coincidence.</li>
 * </ul>
 *
 * <p>Checking "secret configured" rather than "IAM enabled" is what makes staged enablement
 * possible (HLD §4.3): an operator can configure the secret, let every pipeline roll with a
 * credential nothing yet requires, and only then flip {@code conductor.security.enabled}, with
 * no window in which a notification is rejected.
 *
 * <p>Priority is {@code AUTHENTICATION}, not {@code AUTHORIZATION}: this establishes who the
 * caller is (or rejects outright), ahead of any permission evaluation. It is not
 * {@code @PreMatching}, so path parameters are already resolved when it runs; it would need to
 * become so only if it ever started installing a {@code SecurityContext} rather than merely
 * allowing or aborting.
 */
@Provider
@Priority(Priorities.AUTHENTICATION)
public class InternalCredentialFilter implements ContainerRequestFilter {

    static final String INTERNAL_PATH_PREFIX = "internal/";
    private static final String X_FORWARDED_FOR = "X-Forwarded-For";
    private static final String FORWARDED = "Forwarded";
    private static final String PIPELINE_ID_PATH_PARAM = "pipelineId";

    private final Logger logger;
    private final InternalCredentialService credentials;

    public InternalCredentialFilter(Logger logger, InternalCredentialService credentials) {
        this.logger = logger;
        this.credentials = credentials;
    }

    @Override
    public void filter(ContainerRequestContext requestContext) {
        boolean internalPath = isInternalPath(requestContext.getUriInfo().getPath());

        if (!credentials.isConfigured()) {
            if (internalPath && cameThroughProxy(requestContext)) {
                reject(requestContext, Response.Status.FORBIDDEN,
                        "internal endpoints are reachable only via the in-cluster conductor Service");
            }
            return;
        }

        if (!internalPath) {
            rejectIfInternalCredentialPresented(requestContext);
            return;
        }

        Long pipelineId = pipelineIdFrom(requestContext);
        if (pipelineId == null || !credentials.verify(pipelineId, bearerToken(requestContext))) {
            reject(requestContext, Response.Status.UNAUTHORIZED, "missing or invalid internal credential");
        }
    }

    private void rejectIfInternalCredentialPresented(ContainerRequestContext requestContext) {
        if (InternalCredentialService.looksLikeOurCredential(bearerToken(requestContext))) {
            reject(requestContext, Response.Status.UNAUTHORIZED, "an internal credential is not valid at this path");
        }
    }

    private void reject(ContainerRequestContext requestContext, Response.Status status, String reason) {
        logger.warnf("Rejected request to '%s': %s", requestContext.getUriInfo().getPath(), reason);
        requestContext.abortWith(Response.status(status).build());
    }

    private static Long pipelineIdFrom(ContainerRequestContext requestContext) {
        String raw = requestContext.getUriInfo().getPathParameters().getFirst(PIPELINE_ID_PATH_PARAM);
        if (raw == null) {
            return null;
        }
        try {
            return Long.valueOf(raw);
        }
        catch (NumberFormatException e) {
            return null;
        }
    }

    private static String bearerToken(ContainerRequestContext requestContext) {
        return InternalCredentialService.bearerToken(requestContext.getHeaderString(HttpHeaders.AUTHORIZATION));
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
