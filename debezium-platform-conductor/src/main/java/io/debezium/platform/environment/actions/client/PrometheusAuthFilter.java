/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions.client;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.ws.rs.client.ClientRequestContext;
import jakarta.ws.rs.client.ClientRequestFilter;
import jakarta.ws.rs.core.HttpHeaders;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.config.PrometheusConfigGroup;
import io.debezium.platform.config.PrometheusConfigGroup.AuthConfigGroup;
import io.quarkus.runtime.StartupEvent;

/**
 * Adds the configured credentials to every request the conductor sends to Prometheus.
 * <p>
 * Managed Prometheus endpoints are rarely open: on OpenShift, for instance, the only endpoints a
 * workload can reach sit behind kube-rbac-proxy and expect a service account token. Without any
 * credentials configured this filter does nothing.
 * </p>
 */
@ApplicationScoped
public class PrometheusAuthFilter implements ClientRequestFilter {

    private static final Logger LOGGER = LoggerFactory.getLogger(PrometheusAuthFilter.class);

    private final AuthConfigGroup auth;
    private final String prometheusUrl;

    public PrometheusAuthFilter(PrometheusConfigGroup config,
                                @ConfigProperty(name = "quarkus.rest-client.prometheus-api.url") String prometheusUrl) {
        this.auth = config.auth();
        this.prometheusUrl = prometheusUrl;
    }

    /**
     * Rejects an ambiguous configuration when the conductor starts rather than on the first query,
     * which may be minutes later and would only show up as an empty panel.
     * <p>
     * Credentials for a plain HTTP URL are rejected too, unless explicitly allowed: the header would
     * be readable by anything on the path to Prometheus, and a service account token is a credential
     * for the whole cluster API, not only for Prometheus.
     * </p>
     */
    void validate(@Observes StartupEvent event) {
        List<String> configured = new ArrayList<>();
        if (auth.bearerTokenFile().isPresent()) {
            configured.add("monitoring.prometheus.auth.bearer-token-file");
        }
        if (auth.bearerToken().isPresent()) {
            configured.add("monitoring.prometheus.auth.bearer-token");
        }
        boolean hasUsername = auth.basic().username().isPresent();
        boolean hasPassword = auth.basic().password().isPresent();
        if (hasUsername || hasPassword) {
            configured.add("monitoring.prometheus.auth.basic");
        }

        if (configured.size() > 1) {
            throw new IllegalStateException(
                    "Only one Prometheus authentication method can be configured, found: " + String.join(", ", configured));
        }
        if (hasUsername != hasPassword) {
            throw new IllegalStateException(
                    "Prometheus basic authentication requires both monitoring.prometheus.auth.basic.username and "
                            + "monitoring.prometheus.auth.basic.password");
        }
        if (!configured.isEmpty() && prometheusUrl.regionMatches(true, 0, "http://", 0, 7)) {
            if (!auth.allowInsecureTransport()) {
                throw new IllegalStateException(
                        "Prometheus credentials are configured but '" + prometheusUrl + "' is not an HTTPS URL, so they would be sent "
                                + "in clear text. Use an https:// URL, or set monitoring.prometheus.auth.allow-insecure-transport to true "
                                + "if the connection is encrypted by other means");
            }
            LOGGER.warn("Prometheus credentials are sent to '{}' in clear text, as allowed by "
                    + "monitoring.prometheus.auth.allow-insecure-transport", prometheusUrl);
        }
    }

    @Override
    public void filter(ClientRequestContext requestContext) throws IOException {
        Optional<String> authorization = authorization();
        if (authorization.isPresent()) {
            requestContext.getHeaders().putSingle(HttpHeaders.AUTHORIZATION, authorization.get());
        }
    }

    private Optional<String> authorization() throws IOException {
        if (auth.bearerTokenFile().isPresent()) {
            return Optional.of("Bearer " + readToken(Path.of(auth.bearerTokenFile().get())));
        }
        if (auth.bearerToken().isPresent()) {
            return Optional.of("Bearer " + auth.bearerToken().get());
        }
        if (auth.basic().username().isPresent() && auth.basic().password().isPresent()) {
            String credentials = auth.basic().username().get() + ":" + auth.basic().password().get();
            return Optional.of("Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8)));
        }
        return Optional.empty();
    }

    /**
     * Reads the token on every request instead of caching it: Kubernetes rotates projected service
     * account tokens in place, and the file is a few hundred bytes on an in-memory volume.
     * A missing or empty file fails the request rather than sending it unauthenticated, so that the
     * cause is reported here and not as a 401 from Prometheus.
     */
    private static String readToken(Path tokenFile) throws IOException {
        String token;
        try {
            token = Files.readString(tokenFile, StandardCharsets.UTF_8).strip();
        }
        catch (IOException e) {
            throw new IOException("Unable to read the Prometheus bearer token file '" + tokenFile + "'", e);
        }
        if (token.isEmpty()) {
            throw new IOException("The Prometheus bearer token file '" + tokenFile + "' is empty");
        }
        return token;
    }
}
