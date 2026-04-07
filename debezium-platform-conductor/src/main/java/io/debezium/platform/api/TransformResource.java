/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
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

import io.debezium.platform.api.dto.TransformRequest;
import io.debezium.platform.api.dto.TransformResponse;
import io.debezium.platform.api.mapper.TransformMapper;
import io.debezium.platform.domain.TransformService;
import io.debezium.platform.error.NotFoundException;

@Tag(name = "transforms")
@OpenAPIDefinition(info = @Info(title = "Transform API", description = "CRUD operations over Source revault", version = "0.1.0", contact = @Contact(name = "Debezium", url = "https://github.com/debezium/debezium")))
@Path("/transforms")
public class TransformResource {

    Logger logger;
    TransformService transformService;
    TransformMapper mapper;

    public TransformResource(Logger logger, TransformService transformService, TransformMapper mapper) {
        this.logger = logger;
        this.transformService = transformService;
        this.mapper = mapper;
    }

    @Operation(summary = "Returns all available transformations")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = TransformResponse.class, required = true, type = SchemaType.ARRAY)))
    @GET
    public Response get() {
        var transforms = transformService.list();
        return Response.ok(mapper.toResponseList(transforms)).build();
    }

    @Operation(summary = "Returns a transform with given id")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = TransformResponse.class, required = true)))
    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        return transformService.findById(id)
                .map(mapper::toResponse)
                .map(dto -> Response.ok(dto).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }

    @Operation(summary = "Creates new transform")
    @APIResponse(responseCode = "201", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = URI.class, required = true)))
    @POST
    public Response post(@NotNull @Valid TransformRequest request, @Context UriInfo uriInfo) {
        var view = transformService.createEmpty();
        mapper.applyToView(request, view);
        var created = transformService.create(view);
        URI uri = uriInfo.getAbsolutePathBuilder()
                .path(Long.toString(created.getId()))
                .build();
        return Response.created(uri).entity(mapper.toResponse(created)).build();
    }

    @Operation(summary = "Updates an existing transform")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = TransformResponse.class, required = true)))
    @PUT
    @Path("/{id}")
    public Response put(@PathParam("id") Long id, @NotNull @Valid TransformRequest request) {
        var view = transformService.findById(id).orElseThrow(() -> new NotFoundException(id));
        mapper.applyToView(request, view);
        var updated = transformService.update(view);
        return Response.ok(mapper.toResponse(updated)).build();
    }

    @Operation(summary = "Deletes an existing transform")
    @APIResponse(responseCode = "204")
    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        transformService.delete(id);
        return Response.status(Response.Status.NO_CONTENT).build();
    }
}
