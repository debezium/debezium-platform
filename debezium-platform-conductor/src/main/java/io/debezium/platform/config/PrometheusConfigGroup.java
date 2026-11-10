/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import java.util.Optional;

import io.quarkus.runtime.annotations.ConfigPhase;
import io.quarkus.runtime.annotations.ConfigRoot;
import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithName;

/**
 * Configuration of the Prometheus instance the conductor queries for the monitoring panels and the
 * alert evaluation.
 * <p>
 * The URL and the TLS trust settings live under {@code quarkus.rest-client.prometheus-api} and
 * {@code quarkus.tls.prometheus}; this group holds what the REST client has no setting for, the
 * credentials sent with each query. All of it is optional: with nothing set the conductor queries
 * Prometheus unauthenticated, as it always did.
 * </p>
 */
@ConfigMapping(prefix = "monitoring.prometheus")
@ConfigRoot(phase = ConfigPhase.RUN_TIME)
public interface PrometheusConfigGroup {

    AuthConfigGroup auth();

    /**
     * Credentials for the Prometheus HTTP API. At most one of bearer token file, bearer token and
     * basic authentication may be configured.
     */
    interface AuthConfigGroup {

        /**
         * Path of a file holding a bearer token, for example the Kubernetes service account token.
         * The file is read on every request, so a token rotated on disk is picked up without a restart.
         */
        @WithName("bearer-token-file")
        Optional<String> bearerTokenFile();

        /**
         * A static bearer token.
         */
        @WithName("bearer-token")
        Optional<String> bearerToken();

        BasicConfigGroup basic();

        interface BasicConfigGroup {

            Optional<String> username();

            Optional<String> password();
        }
    }
}
