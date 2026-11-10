/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.actions.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import jakarta.ws.rs.client.ClientRequestContext;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import io.debezium.doc.FixFor;
import io.debezium.platform.config.PrometheusConfigGroup;
import io.debezium.platform.config.PrometheusConfigGroup.AuthConfigGroup;
import io.debezium.platform.config.PrometheusConfigGroup.AuthConfigGroup.BasicConfigGroup;

class PrometheusAuthFilterTest {

    private static final String HTTPS_URL = "https://prometheus.example.com";

    @TempDir
    Path tempDir;

    @Test
    @FixFor("debezium/dbz#3049")
    void sendsNoAuthorizationHeaderWhenNothingIsConfigured() throws IOException {
        PrometheusAuthFilter filter = filter(null, null, null, null);

        assertThatCode(() -> filter.validate(null)).doesNotThrowAnyException();
        assertThat(authorizationSentBy(filter)).isNull();
    }

    @Test
    @FixFor("debezium/dbz#3049")
    void sendsTheStaticBearerToken() throws IOException {
        PrometheusAuthFilter filter = filter(null, "static-token", null, null);

        assertThat(authorizationSentBy(filter)).isEqualTo("Bearer static-token");
    }

    @Test
    @FixFor("debezium/dbz#3049")
    void sendsBasicCredentials() throws IOException {
        PrometheusAuthFilter filter = filter(null, null, "Aladdin", "open sesame");

        assertThat(authorizationSentBy(filter)).isEqualTo("Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==");
    }

    @Test
    @FixFor("debezium/dbz#3049")
    void readsTheBearerTokenFileOnEveryRequest() throws IOException {
        Path tokenFile = tempDir.resolve("token");
        Files.writeString(tokenFile, "first-token\n");
        PrometheusAuthFilter filter = filter(tokenFile.toString(), null, null, null);

        assertThat(authorizationSentBy(filter)).isEqualTo("Bearer first-token");

        Files.writeString(tokenFile, "rotated-token\n");

        assertThat(authorizationSentBy(filter)).isEqualTo("Bearer rotated-token");
    }

    @Test
    @FixFor("debezium/dbz#3049")
    void failsTheRequestWhenTheBearerTokenFileIsMissing() {
        Path tokenFile = tempDir.resolve("missing");
        PrometheusAuthFilter filter = filter(tokenFile.toString(), null, null, null);

        assertThatThrownBy(() -> authorizationSentBy(filter))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("Unable to read the Prometheus bearer token file")
                .hasMessageContaining(tokenFile.toString());
    }

    @Test
    @FixFor("debezium/dbz#3049")
    void failsTheRequestWhenTheBearerTokenFileIsEmpty() throws IOException {
        Path tokenFile = tempDir.resolve("token");
        Files.writeString(tokenFile, "\n");
        PrometheusAuthFilter filter = filter(tokenFile.toString(), null, null, null);

        assertThatThrownBy(() -> authorizationSentBy(filter))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("is empty");
    }

    @Test
    @FixFor("debezium/dbz#3049")
    void rejectsMoreThanOneAuthenticationMethod() {
        PrometheusAuthFilter filter = filter("/var/run/secrets/token", null, "user", "password");

        assertThatThrownBy(() -> filter.validate(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Only one Prometheus authentication method")
                .hasMessageContaining("monitoring.prometheus.auth.bearer-token-file")
                .hasMessageContaining("monitoring.prometheus.auth.basic");
    }

    @Test
    @FixFor("debezium/dbz#3049")
    void rejectsBasicAuthenticationWithoutPassword() {
        PrometheusAuthFilter filter = filter(null, null, "user", null);

        assertThatThrownBy(() -> filter.validate(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("requires both");
    }

    private static String authorizationSentBy(PrometheusAuthFilter filter) throws IOException {
        MultivaluedMap<String, Object> headers = new MultivaluedHashMap<>();
        ClientRequestContext requestContext = mock(ClientRequestContext.class);
        when(requestContext.getHeaders()).thenReturn(headers);

        filter.filter(requestContext);

        return (String) headers.getFirst(HttpHeaders.AUTHORIZATION);
    }

    private static PrometheusAuthFilter filter(String bearerTokenFile, String bearerToken, String username, String password) {
        BasicConfigGroup basic = mock(BasicConfigGroup.class);
        when(basic.username()).thenReturn(Optional.ofNullable(username));
        when(basic.password()).thenReturn(Optional.ofNullable(password));

        AuthConfigGroup auth = mock(AuthConfigGroup.class);
        when(auth.bearerTokenFile()).thenReturn(Optional.ofNullable(bearerTokenFile));
        when(auth.bearerToken()).thenReturn(Optional.ofNullable(bearerToken));
        when(auth.basic()).thenReturn(basic);

        PrometheusConfigGroup config = mock(PrometheusConfigGroup.class);
        when(config.auth()).thenReturn(auth);

        return new PrometheusAuthFilter(config, HTTPS_URL);
    }
}
