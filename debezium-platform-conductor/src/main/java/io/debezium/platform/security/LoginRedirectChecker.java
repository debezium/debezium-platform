/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.security;

import jakarta.enterprise.context.ApplicationScoped;

import io.quarkus.oidc.JavaScriptRequestChecker;
import io.quarkus.vertx.http.runtime.security.ChallengeData;
import io.vertx.ext.web.RoutingContext;

/**
 * In {@code hybrid} mode a request without a bearer token goes through the authorization code flow, whose challenge
 * is a redirect to the provider. Only the login endpoint, opened by the browser as a full page, should redirect;
 * every other unauthenticated request (SPA fetches, scripts) gets a plain {@code 401}, as in bearer-only mode.
 * Requires {@code quarkus.oidc.authentication.java-script-auto-redirect=false}.
 */
@ApplicationScoped
public class LoginRedirectChecker implements JavaScriptRequestChecker {

    static final String LOGIN_PATH = "/api/auth/login";

    @Override
    public boolean isJavaScriptRequest(RoutingContext context) {
        return !LOGIN_PATH.equals(context.normalizedPath());
    }

    @Override
    public ChallengeData getChallenge(RoutingContext context) {
        return new ChallengeData(401, "WWW-Authenticate", "Bearer");
    }
}
