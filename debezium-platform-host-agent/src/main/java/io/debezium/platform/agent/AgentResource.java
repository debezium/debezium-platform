/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at
 * http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;
import static jakarta.ws.rs.core.MediaType.TEXT_PLAIN;

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

import org.eclipse.microprofile.openapi.annotations.OpenAPIDefinition;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.enums.SchemaType;
import org.eclipse.microprofile.openapi.annotations.info.Contact;
import org.eclipse.microprofile.openapi.annotations.info.Info;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.logging.Logger;

/**
 * HTTP boundary for container lifecycle operations on the host agent.
 */
@Tag(name = "host-agent")
@OpenAPIDefinition(info = @Info(title = "Host Agent API", description = "Container lifecycle operations for host-deployed Debezium pipelines", version = "0.1.0", contact = @Contact(name = "Debezium", url = "https://github.com/debezium/debezium")))
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
    @Operation(summary = "Deploys a Debezium Server container")
    @APIResponse(responseCode = "202", description = "Deployment accepted")
    @APIResponse(responseCode = "400", description = "Invalid deployment request")
    @APIResponse(responseCode = "401", description = "Missing or invalid bearer token")
    @APIResponse(responseCode = "500", description = "Container deployment failed")
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
    @Operation(summary = "Removes a deployed Debezium Server container")
    @APIResponse(responseCode = "204", description = "Container removed")
    @APIResponse(responseCode = "400", description = "Invalid container name")
    @APIResponse(responseCode = "401", description = "Missing or invalid bearer token")
    @APIResponse(responseCode = "500", description = "Container removal failed")
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
    @Operation(summary = "Stops a deployed Debezium Server container")
    @APIResponse(responseCode = "204", description = "Container stopped")
    @APIResponse(responseCode = "400", description = "Invalid container name")
    @APIResponse(responseCode = "401", description = "Missing or invalid bearer token")
    @APIResponse(responseCode = "500", description = "Container stop failed")
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
    @Operation(summary = "Starts a deployed Debezium Server container")
    @APIResponse(responseCode = "204", description = "Container started")
    @APIResponse(responseCode = "400", description = "Invalid container name")
    @APIResponse(responseCode = "401", description = "Missing or invalid bearer token")
    @APIResponse(responseCode = "500", description = "Container start failed")
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
    @Operation(summary = "Returns the status of a deployed Debezium Server container")
    @APIResponse(responseCode = "200", description = "Container status", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = ContainerStatus.class, required = true, type = SchemaType.OBJECT)))
    @APIResponse(responseCode = "400", description = "Invalid container name")
    @APIResponse(responseCode = "401", description = "Missing or invalid bearer token")
    @APIResponse(responseCode = "404", description = "Container not found")
    @APIResponse(responseCode = "500", description = "Container status lookup failed")
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
    @Operation(summary = "Returns logs for a deployed Debezium Server container")
    @APIResponse(responseCode = "200", description = "Container logs", content = @Content(mediaType = TEXT_PLAIN, schema = @Schema(implementation = String.class, required = true)))
    @APIResponse(responseCode = "400", description = "Invalid container name")
    @APIResponse(responseCode = "401", description = "Missing or invalid bearer token")
    @APIResponse(responseCode = "500", description = "Container log retrieval failed")
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
