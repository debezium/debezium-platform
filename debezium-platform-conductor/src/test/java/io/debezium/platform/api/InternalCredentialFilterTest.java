/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import io.debezium.doc.FixFor;
import io.debezium.platform.domain.InternalCredentialService;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class InternalCredentialFilterTest {

    private static final String INTERNAL_PATH = "internal/pipelines/1/notifications";
    private static final String PUBLIC_PATH = "pipelines/1/snapshots/progress";
    // 43 characters, no '.': the shape InternalCredentialService produces.
    private static final String CREDENTIAL_SHAPED_TOKEN = "a".repeat(43);

    @Mock
    ContainerRequestContext requestContext;

    @Mock
    UriInfo uriInfo;

    @Mock
    MultivaluedMap<String, String> pathParameters;

    @Mock
    InternalCredentialService credentials;

    @BeforeEach
    void setUp() {
        when(requestContext.getUriInfo()).thenReturn(uriInfo);
        when(uriInfo.getPathParameters()).thenReturn(pathParameters);
    }

    // --- Enforcement not active (no secret, or a secret with IAM still disabled -- see
    // InternalCredentialServiceTest for that distinction, which the filter itself cannot see):
    // falls back to the pre-existing proxy-provenance heuristic ---

    @Test
    @FixFor("debezium/dbz#3003")
    void internalRequestWithForwardedForHeaderIsRejectedWhenEnforcementNotActive() {
        givenEnforcementNotActive();
        givenPath(INTERNAL_PATH);
        when(requestContext.getHeaderString("X-Forwarded-For")).thenReturn("203.0.113.7");

        newFilter().filter(requestContext);

        assertThat(abortedStatus()).isEqualTo(Response.Status.FORBIDDEN.getStatusCode());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void internalRequestWithRfc7239ForwardedHeaderIsRejectedWhenEnforcementNotActive() {
        givenEnforcementNotActive();
        givenPath(INTERNAL_PATH);
        when(requestContext.getHeaderString("Forwarded")).thenReturn("for=203.0.113.7");

        newFilter().filter(requestContext);

        assertThat(abortedStatus()).isEqualTo(Response.Status.FORBIDDEN.getStatusCode());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void inClusterInternalRequestWithoutForwardingHeadersIsAllowedWhenEnforcementNotActive() {
        givenEnforcementNotActive();
        givenPath(INTERNAL_PATH);

        newFilter().filter(requestContext);

        verify(requestContext, never()).abortWith(any());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void publicEndpointIsNeverBlockedByTheProxyHeuristic() {
        givenEnforcementNotActive();
        givenPath(PUBLIC_PATH);
        when(requestContext.getHeaderString("X-Forwarded-For")).thenReturn("203.0.113.7");

        newFilter().filter(requestContext);

        verify(requestContext, never()).abortWith(any());
    }

    // --- Enforcement active (secret configured and IAM enabled): real credential verification ---

    @Test
    @FixFor("debezium/dbz#3003")
    void acceptsRequestWithValidCredential() {
        givenEnforcementActive();
        givenPath(INTERNAL_PATH);
        givenPipelineIdPathParam("1");
        givenBearerToken(CREDENTIAL_SHAPED_TOKEN);
        when(credentials.verify(1L, CREDENTIAL_SHAPED_TOKEN)).thenReturn(true);

        newFilter().filter(requestContext);

        verify(requestContext, never()).abortWith(any());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void rejectsInternalRequestWithNoCredential() {
        givenEnforcementActive();
        givenPath(INTERNAL_PATH);
        givenPipelineIdPathParam("1");

        newFilter().filter(requestContext);

        assertThat(abortedStatus()).isEqualTo(Response.Status.UNAUTHORIZED.getStatusCode());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void rejectsInternalRequestWithCredentialForAnotherPipeline() {
        givenEnforcementActive();
        givenPath(INTERNAL_PATH);
        givenPipelineIdPathParam("1");
        givenBearerToken(CREDENTIAL_SHAPED_TOKEN);
        when(credentials.verify(1L, CREDENTIAL_SHAPED_TOKEN)).thenReturn(false);

        newFilter().filter(requestContext);

        assertThat(abortedStatus()).isEqualTo(Response.Status.UNAUTHORIZED.getStatusCode());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void rejectsInternalRequestWithNonNumericPipelineId() {
        givenEnforcementActive();
        givenPath(INTERNAL_PATH);
        givenPipelineIdPathParam("not-a-number");

        newFilter().filter(requestContext);

        assertThat(abortedStatus()).isEqualTo(Response.Status.UNAUTHORIZED.getStatusCode());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void rejectsInternalCredentialShapedTokenPresentedAtAUserPath() {
        givenEnforcementActive();
        givenPath(PUBLIC_PATH);
        givenBearerToken(CREDENTIAL_SHAPED_TOKEN);

        newFilter().filter(requestContext);

        assertThat(abortedStatus()).isEqualTo(Response.Status.UNAUTHORIZED.getStatusCode());
    }

    @Test
    @FixFor("debezium/dbz#3003")
    void allowsAnOrdinaryBearerTokenAtAUserPath() {
        givenEnforcementActive();
        givenPath(PUBLIC_PATH);
        // Shaped like a JWT (contains '.'), not like our derived credential.
        givenBearerToken("header.payload.signature");

        newFilter().filter(requestContext);

        verify(requestContext, never()).abortWith(any());
    }

    private void givenEnforcementNotActive() {
        when(credentials.isEnforcementActive()).thenReturn(false);
    }

    private void givenEnforcementActive() {
        when(credentials.isEnforcementActive()).thenReturn(true);
    }

    private void givenPath(String path) {
        when(uriInfo.getPath()).thenReturn(path);
    }

    private void givenPipelineIdPathParam(String value) {
        when(pathParameters.getFirst("pipelineId")).thenReturn(value);
    }

    private void givenBearerToken(String token) {
        when(requestContext.getHeaderString(HttpHeaders.AUTHORIZATION)).thenReturn("Bearer " + token);
    }

    private InternalCredentialFilter newFilter() {
        return new InternalCredentialFilter(Logger.getLogger(InternalCredentialFilterTest.class), credentials);
    }

    private int abortedStatus() {
        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(requestContext).abortWith(captor.capture());
        return captor.getValue().getStatus();
    }
}
