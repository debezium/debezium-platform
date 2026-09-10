/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import org.jboss.logging.Logger;

/**
 * HTTP boundary for container lifecycle operations on the host agent.
 */
@Path("/api/agent")
@Produces(MediaType.APPLICATION_JSON)
public class AgentResource {

    private static final Logger LOGGER = Logger.getLogger(AgentResource.class);
    private static final String CONTAINER_NAME_PATTERN = "[A-Za-z0-9][A-Za-z0-9_.-]*";

    private final AgentContainerService containerService;

    AgentResource(AgentContainerService containerService) {
        this.containerService = containerService;
    }

    @POST
    @Path("/deploy")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response deploy(@Valid DeployRequest request) {
        try {
            containerService.deploy(request);
            return Response.accepted().build();
        }
        catch (AgentOperationException e) {
            return operationFailed("deploy", request.containerName(), e);
        }
    }

    @POST
    @Path("/undeploy/{containerName}")
    public Response undeploy(
                             @PathParam("containerName") @Pattern(regexp = CONTAINER_NAME_PATTERN, message = "The container name contains unsupported characters") String containerName) {
        try {
            containerService.undeploy(containerName);
            return Response.noContent().build();
        }
        catch (AgentOperationException e) {
            return operationFailed("undeploy", containerName, e);
        }
    }

    @POST
    @Path("/stop/{containerName}")
    public Response stop(
                         @PathParam("containerName") @Pattern(regexp = CONTAINER_NAME_PATTERN, message = "The container name contains unsupported characters") String containerName) {
        try {
            containerService.stop(containerName);
            return Response.noContent().build();
        }
        catch (AgentOperationException e) {
            return operationFailed("stop", containerName, e);
        }
    }

    @POST
    @Path("/start/{containerName}")
    public Response start(
                          @PathParam("containerName") @Pattern(regexp = CONTAINER_NAME_PATTERN, message = "The container name contains unsupported characters") String containerName) {
        try {
            containerService.start(containerName);
            return Response.noContent().build();
        }
        catch (AgentOperationException e) {
            return operationFailed("start", containerName, e);
        }
    }

    @GET
    @Path("/status/{containerName}")
    public Response status(
                           @PathParam("containerName") @Pattern(regexp = CONTAINER_NAME_PATTERN, message = "The container name contains unsupported characters") String containerName) {
        try {
            return containerService.status(containerName)
                    .map(status -> Response.ok(status).build())
                    .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
        }
        catch (AgentOperationException e) {
            return operationFailed("get status for", containerName, e);
        }
    }

    @GET
    @Path("/logs/{containerName}")
    @Produces(MediaType.TEXT_PLAIN)
    public Response logs(
                         @PathParam("containerName") @Pattern(regexp = CONTAINER_NAME_PATTERN, message = "The container name contains unsupported characters") String containerName) {
        try {
            return Response.ok(containerService.logs(containerName)).build();
        }
        catch (AgentOperationException e) {
            return operationFailed("get logs for", containerName, e);
        }
    }

    private Response operationFailed(String operation, String containerName, AgentOperationException e) {
        LOGGER.errorf(e, "Unable to %s container '%s'", operation, containerName);
        return Response.serverError().entity(e.getMessage()).build();
    }

}
