/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.debezium.platform.security.EmailAllowlist.AUDIT;
import static io.debezium.platform.security.EmailAllowlist.user;

import java.util.Map;
import java.util.Objects;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriBuilder;

import org.eclipse.microprofile.jwt.JsonWebToken;
import org.eclipse.microprofile.openapi.annotations.Operation;

import io.debezium.platform.security.EmailAllowlist;
import io.quarkus.oidc.OidcConfigurationMetadata;
import io.quarkus.oidc.OidcSession;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;

/**
 * Browser login/logout for the UI. With OIDC enabled, {@code /api/*} requires authentication, so anonymous callers
 * get {@code 401} here, except {@code login}, which the code flow turns into a redirect to the provider.
 */
@Path("auth")
public class AuthResource {

    @Inject
    SecurityIdentity identity;

    @Inject
    EmailAllowlist allowlist;

    @Inject
    OidcSession session;

    @Inject
    OidcConfigurationMetadata metadata;

    @GET
    @Path("me")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Returns the logged-in user; 403 when not in the allowlist, anonymous when OIDC is off")
    public Response me() {
        if (identity.isAnonymous()) {
            return Response.ok(Map.of("anonymous", true)).build();
        }
        String email = user(identity);
        var body = Map.of("email", email, "name", Objects.requireNonNullElse(identity.getPrincipal().getName(), email));
        return Response.status(allowlist.denyReason(identity) == null ? 200 : 403).entity(body).build();
    }

    @GET
    @Path("login")
    @Operation(summary = "Starts the browser login, then redirects to the given relative path")
    public Response login(@QueryParam("redirect") String redirect) {
        // Reached once the code flow has authenticated the caller
        if (!identity.isAnonymous()) {
            String reason = allowlist.denyReason(identity);
            AUDIT.infof("AUDIT user=%s event=%s", user(identity), reason == null ? "login" : "login_denied reason=" + reason);
        }
        return redirect(isLocalPath(redirect) ? redirect : "/");
    }

    @GET
    @Path("logout")
    @Operation(summary = "Ends the session, and the provider session when it supports RP-initiated logout")
    public Uni<Response> logout() {
        if (identity.isAnonymous()) {
            return Uni.createFrom().item(redirect("/"));
        }
        AUDIT.infof("AUDIT user=%s event=logout", user(identity));
        JsonWebToken idToken = session.getIdToken();
        String endSession = metadata.getEndSessionUri();
        // Providers without an end_session_endpoint (e.g. Google) keep their own session
        String target = endSession == null || idToken == null ? "/"
                : UriBuilder.fromUri(endSession).queryParam("id_token_hint", idToken.getRawToken()).build().toString();
        return session.logout().replaceWith(redirect(target));
    }

    /** Sets Location as given, so a relative path is not resolved against the internal scheme/host behind a proxy. */
    private static Response redirect(String location) {
        return Response.status(Response.Status.SEE_OTHER).header("Location", location).build();
    }

    /** Only same-site paths, to avoid an open redirect. */
    static boolean isLocalPath(String path) {
        return path != null && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
    }
}
