/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;
import static jakarta.ws.rs.core.MediaType.TEXT_PLAIN;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;

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

import io.debezium.platform.api.dto.PipelineRequest;
import io.debezium.platform.api.dto.PipelineResponse;
import io.debezium.platform.api.mapper.PipelineMapper;
import io.debezium.platform.data.dto.SignalRequest;
import io.debezium.platform.data.dto.SignalResponse;
import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.domain.Signal;
import io.debezium.platform.environment.EnvironmentController;
import io.debezium.platform.environment.logs.LogReader;
import io.debezium.platform.error.NotFoundException;
import io.smallrye.common.annotation.RunOnVirtualThread;

@Tag(name = "pipelines")
@OpenAPIDefinition(info = @Info(title = "Pipeline API", description = "CRUD operations over Pipeline resource", version = "0.1.0", contact = @Contact(name = "Debezium", url = "https://github.com/debezium/debezium")))
@Path("/pipelines")
public class PipelineResource {

    Logger logger;
    PipelineService pipelineService;
    PipelineMapper mapper;

    public PipelineResource(Logger logger, PipelineService pipelineService, PipelineMapper mapper) {
        this.logger = logger;
        this.pipelineService = pipelineService;
        this.mapper = mapper;
    }

    @Operation(summary = "Returns all available pipelines")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = PipelineResponse.class, required = true, type = SchemaType.ARRAY)))
    @GET
    public Response get() {
        var pipelines = pipelineService.list();
        return Response.ok(mapper.toResponseList(pipelines)).build();
    }

    @Operation(summary = "Returns a pipeline with given id")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = PipelineResponse.class, required = true)))
    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        return pipelineService.findById(id)
                .map(mapper::toResponse)
                .map(dto -> Response.ok(dto).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }

    @Operation(summary = "Creates new pipeline")
    @APIResponse(responseCode = "201", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = URI.class, required = true)))
    @POST
    public Response post(@NotNull @Valid PipelineRequest request, @Context UriInfo uriInfo) {
        var view = pipelineService.createEmpty();
        mapper.applyToView(request, view);
        var created = pipelineService.create(view);
        URI uri = uriInfo.getAbsolutePathBuilder()
                .path(Long.toString(created.getId()))
                .build();
        return Response.created(uri).entity(mapper.toResponse(created)).build();
    }

    @Operation(summary = "Updates an existing pipeline")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = PipelineResponse.class, required = true)))
    @PUT
    @Path("/{id}")
    public Response put(@PathParam("id") Long id, @NotNull @Valid PipelineRequest request) {
        var view = pipelineService.findById(id)
                .orElseThrow(() -> new NotFoundException(id));
        mapper.applyToView(request, view);
        var updated = pipelineService.update(view);
        return Response.ok(mapper.toResponse(updated)).build();
    }

    @Operation(summary = "Deletes an existing pipeline")
    @APIResponse(responseCode = "204")
    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        pipelineService.delete(id);
        return Response.status(Response.Status.NO_CONTENT).build();
    }

    @Operation(summary = "Returns logs for pipeline with given id")
    @APIResponse(responseCode = "200", content = @Content(mediaType = TEXT_PLAIN, schema = @Schema(implementation = String.class, required = true)))
    @GET
    @Path("/{id}/logs")
    @Produces(TEXT_PLAIN)
    @RunOnVirtualThread
    public Response getLogById(@PathParam("id") Long id) {
        return pipelineService.environmentController(id)
                .map(EnvironmentController::pipelines)
                .map(pipelines -> pipelines.logReader(id))
                .map(LogReader::readAll)
                .map(log -> Response.ok(log)
                        .header("Content-Disposition", "attachment; filename=pipeline.log")
                        .build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }

    @Operation(summary = "Send signal to pipeline with given id")
    @APIResponse(responseCode = "202", description = "Signal correctly sent to the pipeline", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = SignalResponse.class, required = true)))
    @APIResponse(responseCode = "404", description = "Pipeline not found")
    @POST
    @Path("/{id}/signals")
    @Produces(APPLICATION_JSON)
    public Response sendSignal(@PathParam("id") Long id, @NotNull @Valid SignalRequest signalRequest) {

        Signal signal = new Signal(signalRequest.id(),
                signalRequest.type(),
                signalRequest.data(),
                signalRequest.additionalData());

        return pipelineService.send(id, signal)
                .map(signalId -> Response.accepted(SignalResponse.from(signalId)).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }
}
