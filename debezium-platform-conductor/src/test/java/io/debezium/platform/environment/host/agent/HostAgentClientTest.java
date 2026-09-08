/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.rest.client.annotation.ClientHeaderParam;
import org.jboss.logging.Logger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Unit tests for response handling and token-header setup in {@link HostAgentClient}. */
class HostAgentClientTest {

    private HostAgentApi agentApi;
    private HostAgentClient client;

    @BeforeEach
    void setUp() {
        agentApi = mock(HostAgentApi.class);
        client = new HostAgentClient(Logger.getLogger(HostAgentClientTest.class), agentApi);
    }

    @Test
    void deployPassesTheTokenToTheHeaderTemplateAndClosesTheResponse() {
        Response response = mock(Response.class);
        when(response.getStatus()).thenReturn(Response.Status.ACCEPTED.getStatusCode());
        when(agentApi.deploy("http://host-1:8090", "host-token",
                new AgentDeployRequest("pipeline-1", "image", 9000, "config")))
                .thenReturn(response);

        client.deploy("host-1", 8090, "host-token", "pipeline-1", "image", 9000, "config");

        verify(response).close();
    }

    @Test
    void statusReturnsNullForNotFoundAndClosesTheResponse() {
        Response response = mock(Response.class);
        when(response.getStatus()).thenReturn(Response.Status.NOT_FOUND.getStatusCode());
        when(agentApi.status("http://host-1:8090", "host-token", "pipeline-1")).thenReturn(response);

        assertThat(client.status("host-1", 8090, "host-token", "pipeline-1")).isNull();
        verify(response).close();
    }

    @Test
    void apiUsesTheMethodTokenForTheAuthorizationHeader() {
        ClientHeaderParam header = HostAgentApi.class.getAnnotation(ClientHeaderParam.class);

        assertThat(header.name()).isEqualTo("Authorization");
        assertThat(header.value()).containsExactly("Bearer {agentToken}");
    }
}
