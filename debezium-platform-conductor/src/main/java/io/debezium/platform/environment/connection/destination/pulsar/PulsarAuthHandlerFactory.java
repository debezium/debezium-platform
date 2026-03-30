/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination.pulsar;

import io.debezium.util.Strings;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.literal.NamedLiteral;

@ApplicationScoped
public class PulsarAuthHandlerFactory {
    private final Instance<PulsarAuthHandler> authHandlers;

    public PulsarAuthHandlerFactory(Instance<PulsarAuthHandler> authHandlers) {
        this.authHandlers = authHandlers;
    }

    public PulsarAuthHandler getAuthHandler(String authType) {
        if (Strings.isNullOrEmpty(authType)) {
            throw new IllegalArgumentException("Auth type cannot be null");
        }
        String authHandlerName = mapToAuthHandlerName(authType);
        return authHandlers
                .select(NamedLiteral.of(authHandlerName))
                .get();
    }

    private String mapToAuthHandlerName(String authType) {
        return switch (authType.toLowerCase()) {
            case "basic" -> "BASIC";
            case "jwt" -> "JWT";
            case "oauth2" -> "OAUTH2";
            case "openid" -> "OPENID";
            case "kerberos" -> "KERBEROS";
            case "none" -> "NONE";
            default -> throw new IllegalArgumentException("Unsupported auth scheme: " + authType);
        };
    }
}
