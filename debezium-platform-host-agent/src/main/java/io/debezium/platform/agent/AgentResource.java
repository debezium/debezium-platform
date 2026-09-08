/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import java.util.Optional;
import java.util.regex.Pattern;

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
    private static final Pattern CONTAINER_NAME_PATTERN = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_.-]*");

    private final AgentContainerService containerService;

    AgentResource(AgentContainerService containerService) {
        this.containerService = containerService;
    }

    @POST
    @Path("/deploy")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response deploy(DeployRequest request) {
        Optional<Response> validationError = validateDeployRequest(request);
        if (validationError.isPresent()) {
            return validationError.get();
        }

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
    public Response undeploy(@PathParam("containerName") String containerName) {
        return withValidContainerName(containerName, () -> {
            containerService.undeploy(containerName);
            return Response.noContent().build();
        }, "undeploy");
    }

    @POST
    @Path("/stop/{containerName}")
    public Response stop(@PathParam("containerName") String containerName) {
        return withValidContainerName(containerName, () -> {
            containerService.stop(containerName);
            return Response.noContent().build();
        }, "stop");
    }

    @POST
    @Path("/start/{containerName}")
    public Response start(@PathParam("containerName") String containerName) {
        return withValidContainerName(containerName, () -> {
            containerService.start(containerName);
            return Response.noContent().build();
        }, "start");
    }

    @GET
    @Path("/status/{containerName}")
    public Response status(@PathParam("containerName") String containerName) {
        Optional<Response> validationError = validateContainerName(containerName);
        if (validationError.isPresent()) {
            return validationError.get();
        }

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
    public Response logs(@PathParam("containerName") String containerName) {
        return withValidContainerName(containerName, () -> Response.ok(containerService.logs(containerName)).build(), "get logs for");
    }

    private Response withValidContainerName(String containerName, AgentOperation operation, String operationName) {
        Optional<Response> validationError = validateContainerName(containerName);
        if (validationError.isPresent()) {
            return validationError.get();
        }

        try {
            return operation.execute();
        }
        catch (AgentOperationException e) {
            return operationFailed(operationName, containerName, e);
        }
    }

    private Optional<Response> validateDeployRequest(DeployRequest request) {
        if (request == null) {
            return Optional.of(badRequest("A deployment request is required"));
        }

        Optional<Response> containerNameError = validateContainerName(request.containerName());
        if (containerNameError.isPresent()) {
            return containerNameError;
        }
        if (request.image() == null || request.image().isBlank()) {
            return Optional.of(badRequest("A container image is required"));
        }
        if (request.port() < 1 || request.port() > 65_535) {
            return Optional.of(badRequest("The container port must be between 1 and 65535"));
        }
        if (request.configContent() == null) {
            return Optional.of(badRequest("Container configuration is required"));
        }
        return Optional.empty();
    }

    private Optional<Response> validateContainerName(String containerName) {
        if (containerName == null || !CONTAINER_NAME_PATTERN.matcher(containerName).matches()) {
            return Optional.of(badRequest("The container name contains unsupported characters"));
        }
        return Optional.empty();
    }

    private Response operationFailed(String operation, String containerName, AgentOperationException e) {
        LOGGER.errorf(e, "Unable to %s container '%s'", operation, containerName);
        return Response.serverError().entity(e.getMessage()).build();
    }

    private Response badRequest(String message) {
        return Response.status(Response.Status.BAD_REQUEST).entity(message).build();
    }

    @FunctionalInterface
    private interface AgentOperation {
        Response execute();
    }
}
