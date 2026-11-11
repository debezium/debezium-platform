/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.security;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;

import io.quarkus.oidc.UserInfo;
import io.quarkus.runtime.Startup;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.vertx.http.runtime.security.HttpSecurityPolicy;
import io.smallrye.mutiny.Uni;
import io.vertx.ext.web.RoutingContext;

/**
 * Restricts the platform to the users listed in a YAML allowlist file:
 *
 * <pre>
 * users:
 *   - email: alice@example.com
 * </pre>
 *
 * The check runs on every {@code /api/*} request (global {@link HttpSecurityPolicy}), so removing an email and
 * restarting the conductor revokes access to existing sessions too. Matching is case-insensitive and requires
 * {@code email_verified=true}. Unknown fields are ignored, leaving room for per-user attributes (e.g. roles) later.
 * <p>
 * When the path is not set, the file does not exist or it lists no users, every authenticated user is allowed
 * (logged as a warning at startup). Fine for an issuer that already decides who can log in (e.g. Keycloak); with a
 * public provider such as Google it means any account of that provider. Malformed content fails startup.
 */
@Startup
@ApplicationScoped
public class EmailAllowlist implements HttpSecurityPolicy {

    public static final Logger AUDIT = Logger.getLogger("io.debezium.platform.audit");
    private static final Logger LOGGER = Logger.getLogger(EmailAllowlist.class);
    private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory())
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    /** {@code null} when the allowlist is not configured, missing or empty: every authenticated user is allowed. */
    private final Set<String> emails;

    @Inject
    public EmailAllowlist(@ConfigProperty(name = "quarkus.oidc.tenant-enabled") boolean oidcEnabled,
                          @ConfigProperty(name = "quarkus.oidc.provider") Optional<String> provider,
                          @ConfigProperty(name = "conductor.auth.allowlist.path") Optional<String> path) {
        this.emails = oidcEnabled ? load(provider, path.filter(p -> !p.isBlank())) : null;
    }

    static Set<String> load(Optional<String> provider, Optional<String> path) {
        Set<String> emails = path.map(EmailAllowlist::read).orElse(Set.of());
        if (emails.isEmpty()) {
            LOGGER.warnf("OIDC allowlist %s: every user authenticated by the issuer%s can access the platform",
                    path.map(p -> "'" + p + "' is missing or empty").orElse("not configured"),
                    provider.map(p -> " (any " + p + " account)").orElse(""));
            return null;
        }
        LOGGER.infof("Loaded OIDC allowlist '%s' with %d user(s)", path.get(), emails.size());
        return emails;
    }

    /** Emails in the file, empty when it does not exist or lists nobody; malformed content fails startup. */
    private static Set<String> read(String path) {
        Path file = Path.of(path);
        if (Files.notExists(file)) {
            return Set.of();
        }
        try {
            JsonNode root = YAML.readTree(file.toFile());
            AllowlistFile allowlist = root == null || root.isMissingNode() || root.isNull() ? null
                    : YAML.treeToValue(root, AllowlistFile.class);
            if (allowlist == null || allowlist.users() == null) {
                return Set.of();
            }
            return allowlist.users().stream()
                    .map(User::email)
                    .filter(Objects::nonNull)
                    .map(e -> e.trim().toLowerCase(Locale.ROOT))
                    .filter(e -> !e.isEmpty())
                    .collect(Collectors.toUnmodifiableSet());
        }
        catch (IOException e) {
            throw new IllegalStateException("Cannot read OIDC allowlist '" + path + "'", e);
        }
    }

    /** @return {@code null} when the identity may access the platform, otherwise why it may not */
    public String denyReason(SecurityIdentity identity) {
        if (emails == null) {
            return null;
        }
        if (!"true".equals(String.valueOf(claim(identity, "email_verified")))) {
            return "email_not_verified";
        }
        String email = claim(identity, "email") instanceof String s ? s.toLowerCase(Locale.ROOT) : null;
        return email != null && emails.contains(email) ? null : "not_in_allowlist";
    }

    @Override
    public Uni<CheckResult> checkPermission(RoutingContext request, Uni<SecurityIdentity> identity,
                                            AuthorizationRequestContext requestContext) {
        String path = request.normalizedPath();
        // /api/auth/* stays reachable so a denied user can see who they are and log out
        if (emails == null || !path.startsWith("/api/") || path.startsWith("/api/auth/")) {
            return Uni.createFrom().item(CheckResult.PERMIT);
        }
        return identity.map(id -> {
            String reason = id.isAnonymous() ? null : denyReason(id);
            if (reason == null) {
                return CheckResult.PERMIT;
            }
            AUDIT.infof("AUDIT user=%s event=access_denied reason=%s path=%s", user(id), reason, path);
            return CheckResult.DENY;
        });
    }

    /** The identity to record in audit logs: the {@code email} claim, else the principal name, else anonymous. */
    public static String user(SecurityIdentity identity) {
        if (identity == null || identity.isAnonymous()) {
            return "anonymous";
        }
        return claim(identity, "email") instanceof String email ? email : identity.getPrincipal().getName();
    }

    /** Reads a claim from the ID/access token, or from UserInfo when the token is opaque (e.g. Google access tokens). */
    private static Object claim(SecurityIdentity identity, String name) {
        if (identity.getPrincipal() instanceof JsonWebToken jwt && jwt.containsClaim(name)) {
            return jwt.getClaim(name);
        }
        UserInfo userInfo = identity.getAttribute("userinfo");
        if (userInfo == null || !userInfo.contains(name)) {
            return null;
        }
        return "email_verified".equals(name) ? userInfo.getBoolean(name) : userInfo.getString(name);
    }

    record AllowlistFile(List<User> users) {
    }

    record User(String email) {
    }
}
