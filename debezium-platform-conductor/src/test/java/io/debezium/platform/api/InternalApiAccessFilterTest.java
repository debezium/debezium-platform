/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.container.ContainerRequestContext;
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

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class InternalApiAccessFilterTest {

    private static final String INTERNAL_PATH = "internal/pipelines/1/notifications";
    private static final String PUBLIC_PATH = "pipelines/1/snapshots/progress";

    @Mock
    ContainerRequestContext requestContext;

    @Mock
    UriInfo uriInfo;

    @BeforeEach
    void setUp() {
        when(requestContext.getUriInfo()).thenReturn(uriInfo);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void internalRequestWithForwardedForHeaderIsRejected() {
        givenPath(INTERNAL_PATH);
        when(requestContext.getHeaderString("X-Forwarded-For")).thenReturn("203.0.113.7");

        newFilter().filter(requestContext);

        assertThat(abortedStatus()).isEqualTo(Response.Status.FORBIDDEN.getStatusCode());
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void internalRequestWithRfc7239ForwardedHeaderIsRejected() {
        givenPath(INTERNAL_PATH);
        when(requestContext.getHeaderString("Forwarded")).thenReturn("for=203.0.113.7");

        newFilter().filter(requestContext);

        assertThat(abortedStatus()).isEqualTo(Response.Status.FORBIDDEN.getStatusCode());
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void internalRequestWithLeadingSlashIsRecognized() {
        givenPath("/" + INTERNAL_PATH);
        when(requestContext.getHeaderString("X-Forwarded-For")).thenReturn("203.0.113.7");

        newFilter().filter(requestContext);

        assertThat(abortedStatus()).isEqualTo(Response.Status.FORBIDDEN.getStatusCode());
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void inClusterInternalRequestWithoutForwardingHeadersIsAllowed() {
        givenPath(INTERNAL_PATH);

        newFilter().filter(requestContext);

        verify(requestContext, never()).abortWith(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void publicEndpointIsNeverBlockedEvenWhenProxied() {
        givenPath(PUBLIC_PATH);
        when(requestContext.getHeaderString("X-Forwarded-For")).thenReturn("203.0.113.7");

        newFilter().filter(requestContext);

        verify(requestContext, never()).abortWith(org.mockito.ArgumentMatchers.any());
    }

    private void givenPath(String path) {
        when(uriInfo.getPath()).thenReturn(path);
    }

    private InternalApiAccessFilter newFilter() {
        return new InternalApiAccessFilter(Logger.getLogger(InternalApiAccessFilterTest.class));
    }

    private int abortedStatus() {
        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(requestContext).abortWith(captor.capture());
        return captor.getValue().getStatus();
    }
}
