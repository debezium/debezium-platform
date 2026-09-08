/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.agent;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.rest.client.annotation.ClientHeaderParam;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

import io.quarkus.rest.client.reactive.NotBody;
import io.quarkus.rest.client.reactive.Url;

/**
 * Quarkus REST Client interface for communicating with the remote Host Agent.
 *
 * <p>Each Agent runs on a different host with a different IP, port, and token.
 * The {@link Url @Url} annotation overrides the base URL per-invocation,
 * following the same pattern as {@link io.debezium.platform.environment.actions.client.DebeziumServerClient}
 * in the operator path.
 *
 * <p>The {@code configKey} is used for Quarkus REST client configuration
 * (timeouts, etc.) in {@code application.properties}:
 * <pre>
 *   quarkus.rest-client.host-agent-api.connect-timeout=5000
 *   quarkus.rest-client.host-agent-api.read-timeout=30000
 * </pre>
 *
 * @see HostAgentClient
 *
 * @author Divyanshu Kumar Nayak
 */
@Path("/api/agent")
@RegisterRestClient(configKey = "host-agent-api")
@ClientHeaderParam(name = "Authorization", value = "Bearer {agentToken}")
public interface HostAgentApi {

    @POST
    @Path("/deploy")
    @Consumes(MediaType.APPLICATION_JSON)
    Response deploy(@Url String baseUrl,
                    @NotBody String agentToken,
                    AgentDeployRequest request);

    @POST
    @Path("/undeploy/{containerName}")
    Response undeploy(@Url String baseUrl,
                      @NotBody String agentToken,
                      @PathParam("containerName") String containerName);

    @POST
    @Path("/stop/{containerName}")
    Response stop(@Url String baseUrl,
                  @NotBody String agentToken,
                  @PathParam("containerName") String containerName);

    @POST
    @Path("/start/{containerName}")
    Response start(@Url String baseUrl,
                   @NotBody String agentToken,
                   @PathParam("containerName") String containerName);

    @GET
    @Path("/status/{containerName}")
    @Produces(MediaType.APPLICATION_JSON)
    Response status(@Url String baseUrl,
                    @NotBody String agentToken,
                    @PathParam("containerName") String containerName);

    @GET
    @Path("/logs/{containerName}")
    @Produces(MediaType.TEXT_PLAIN)
    Response logs(@Url String baseUrl,
                  @NotBody String agentToken,
                  @PathParam("containerName") String containerName);
}
