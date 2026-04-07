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
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
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

import io.debezium.platform.api.dto.ConnectionRequest;
import io.debezium.platform.api.dto.ConnectionResponse;
import io.debezium.platform.api.mapper.ConnectionMapper;
import io.debezium.platform.data.dto.CollectionTree;
import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.ConnectionSchemaService;
import io.debezium.platform.domain.ConnectionService;
import io.debezium.platform.error.NotFoundException;

@Tag(name = "connections")
@OpenAPIDefinition(info = @Info(title = "Connection API", description = "CRUD operations over connection resource", version = "0.1.0", contact = @Contact(name = "Debezium", url = "https://github.com/debezium/debezium")))
@Path("/connections")
public class ConnectionResource {

    Logger logger;
    ConnectionService connectionService;
    ConnectionSchemaService schemaService;
    ConnectionMapper mapper;

    public ConnectionResource(
                              Logger logger,
                              ConnectionService connectionService,
                              ConnectionSchemaService schemaService,
                              ConnectionMapper mapper) {
        this.logger = logger;
        this.connectionService = connectionService;
        this.schemaService = schemaService;
        this.mapper = mapper;
    }

    @Operation(summary = "Returns all available connections")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = ConnectionResponse.class, required = true, type = SchemaType.ARRAY)))
    @GET
    public Response get() {
        var connections = connectionService.list();
        return Response.ok(mapper.toResponseList(connections)).build();
    }

    @Operation(summary = "Returns a connection with given id")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = ConnectionResponse.class, required = true)))
    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        return connectionService.findById(id)
                .map(mapper::toResponse)
                .map(dto -> Response.ok(dto).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }

    @Operation(summary = "Creates new connection")
    @APIResponse(responseCode = "201", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = URI.class, required = true)))
    @POST
    public Response post(@NotNull @Valid ConnectionRequest request, @Context UriInfo uriInfo) {
        var view = connectionService.createEmpty();
        mapper.applyToView(request, view);
        var created = connectionService.create(view);
        URI uri = uriInfo.getAbsolutePathBuilder()
                .path(Long.toString(created.getId()))
                .build();
        return Response.created(uri).entity(mapper.toResponse(created)).build();
    }

    @Operation(summary = "Updates an existing connection")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = ConnectionResponse.class, required = true)))
    @PUT
    @Path("/{id}")
    public Response put(@PathParam("id") Long id, @NotNull @Valid ConnectionRequest request) {
        var view = connectionService.findById(id).orElseThrow(() -> new NotFoundException(id));
        mapper.applyToView(request, view);
        var updated = connectionService.update(view);
        return Response.ok(mapper.toResponse(updated)).build();
    }

    @Operation(summary = "Deletes an existing connection")
    @APIResponse(responseCode = "204")
    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        connectionService.delete(id);
        return Response.status(Response.Status.NO_CONTENT).build();
    }

    @Operation(summary = "Verify that the connection is valid")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = ConnectionValidationResult.class, type = SchemaType.OBJECT)))
    @POST
    @Path("/validate")
    public Response validateConnection(@NotNull @Valid ConnectionRequest request) {
        var view = connectionService.createEmpty();
        mapper.applyToView(request, view);

        var connectionValidationResponse = connectionService.validateConnection(view);

        return Response.ok()
                .type(MediaType.APPLICATION_JSON)
                .entity(connectionValidationResponse).build();
    }

    @Operation(summary = "Returns a list of JSON schema describing the required field for a Connection")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(type = SchemaType.ARRAY)))
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Path("/schemas")
    public Response connectionSchemas() {

        String schemasJson = schemaService.getSchemasJson();

        return Response.ok(schemasJson).build();
    }

    @Operation(summary = "Returns a list of collection names available on the source")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = CollectionTree.class, type = SchemaType.OBJECT)))
    @GET
    @Path("/{id}/collections")
    public Response listAvailableCollections(@PathParam("id") Long id) {

        CollectionTree collections = connectionService.listAvailableCollections(id);

        return Response.ok().entity(collections).build();
    }
}
