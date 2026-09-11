/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import java.security.MessageDigest;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;

import org.jboss.logging.Logger;

/**
 * JAX-RS request filter that enforces bearer token authentication on
 * all {@code /api/agent/*} endpoints.
 *
 * <p>Every request must include a valid {@code Authorization: Bearer <token>}
 * header. The token is compared (timing-safe) against the configured
 * {@code agent.token} value, which originates from the {@code AGENT_TOKEN}
 * environment variable set during Ansible provisioning.
 *
 * <p>Requests without a valid token are rejected with {@code 401 Unauthorized}.
 *
 * <p>Uses {@link MessageDigest#isEqual(byte[], byte[])} for constant-time
 * comparison to prevent timing side-channel attacks — even though the
 * attack surface is low (internal network), this is the standard practice
 * for token validation.
 */
@Provider
@ApplicationScoped
public class AgentTokenFilter implements ContainerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final Logger logger = Logger.getLogger(AgentTokenFilter.class);

    private final AgentConfig config;

    public AgentTokenFilter(AgentConfig config) {
        this.config = config;
    }

    @Override
    public void filter(ContainerRequestContext requestContext) {
        String expectedToken = config.token().orElse("");

        // If no token is configured, authentication is disabled (development mode)
        if (expectedToken == null || expectedToken.isEmpty()) {
            return;
        }

        String authHeader = requestContext.getHeaderString("Authorization");

        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            logger.warnv("Request rejected: missing or malformed Authorization header from {0}",
                    requestContext.getUriInfo().getRequestUri());
            requestContext.abortWith(
                    Response.status(Response.Status.UNAUTHORIZED)
                            .entity("Missing or malformed Authorization header")
                            .build());
            return;
        }

        String providedToken = authHeader.substring(BEARER_PREFIX.length()).trim();

        if (!timingSafeEquals(expectedToken, providedToken)) {
            logger.warnv("Request rejected: invalid bearer token from {0}",
                    requestContext.getUriInfo().getRequestUri());
            requestContext.abortWith(
                    Response.status(Response.Status.UNAUTHORIZED)
                            .entity("Invalid bearer token")
                            .build());
        }
    }

    /**
     * Constant-time string comparison to prevent timing attacks.
     */
    private static boolean timingSafeEquals(String expected, String provided) {
        return MessageDigest.isEqual(
                expected.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                provided.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
