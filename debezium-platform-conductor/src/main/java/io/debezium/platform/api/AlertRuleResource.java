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

import io.debezium.platform.api.dto.AlertRuleRequest;
import io.debezium.platform.api.dto.AlertRuleResponse;
import io.debezium.platform.api.mapper.AlertRuleMapper;
import io.debezium.platform.domain.AlertRuleService;
import io.debezium.platform.error.NotFoundException;

@Tag(name = "alert-rules")
@OpenAPIDefinition(info = @Info(title = "Alert Rule API", description = "CRUD operations over Alert Rule resource", version = "0.1.0", contact = @Contact(name = "Debezium", url = "https://github.com/debezium/debezium")))
@Path("/alerts/rules")
public class AlertRuleResource {

    Logger logger;
    AlertRuleService alertRuleService;
    AlertRuleMapper mapper;

    public AlertRuleResource(Logger logger, AlertRuleService alertRuleService, AlertRuleMapper mapper) {
        this.logger = logger;
        this.alertRuleService = alertRuleService;
        this.mapper = mapper;
    }

    @Operation(summary = "Returns all available alert rules")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = AlertRuleResponse.class, required = true, type = SchemaType.ARRAY)))
    @GET
    public Response get() {
        var rules = alertRuleService.list();
        return Response.ok(mapper.toResponseList(rules)).build();
    }

    @Operation(summary = "Returns an alert rule with given id")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = AlertRuleResponse.class, required = true)))
    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        return alertRuleService.findById(id)
                .map(mapper::toResponse)
                .map(dto -> Response.ok(dto).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }

    @Operation(summary = "Creates a new alert rule")
    @APIResponse(responseCode = "201", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = AlertRuleResponse.class, required = true)))
    @POST
    public Response post(@NotNull @Valid AlertRuleRequest request, @Context UriInfo uriInfo) {
        var view = alertRuleService.createEmpty();
        mapper.applyToView(request, view);
        var created = alertRuleService.create(view);
        URI uri = uriInfo.getAbsolutePathBuilder()
                .path(Long.toString(created.getId()))
                .build();
        return Response.created(uri).entity(mapper.toResponse(created)).build();
    }

    @Operation(summary = "Updates an existing alert rule")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = AlertRuleResponse.class, required = true)))
    @PUT
    @Path("/{id}")
    public Response put(@PathParam("id") Long id, @NotNull @Valid AlertRuleRequest request) {
        var view = alertRuleService.findById(id).orElseThrow(() -> new NotFoundException(id));
        mapper.applyToView(request, view);
        var updated = alertRuleService.update(view);
        return Response.ok(mapper.toResponse(updated)).build();
    }

    @Operation(summary = "Deletes an existing alert rule")
    @APIResponse(responseCode = "204")
    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        alertRuleService.delete(id);
        return Response.status(Response.Status.NO_CONTENT).build();
    }

    @Operation(summary = "Enables an alert rule")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = AlertRuleResponse.class, required = true)))
    @PUT
    @Path("/{id}/enable")
    public Response enable(@PathParam("id") Long id) {
        var rule = alertRuleService.enable(id);
        return Response.ok(mapper.toResponse(rule)).build();
    }

    @Operation(summary = "Disables an alert rule")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = AlertRuleResponse.class, required = true)))
    @PUT
    @Path("/{id}/disable")
    public Response disable(@PathParam("id") Long id) {
        var rule = alertRuleService.disable(id);
        return Response.ok(mapper.toResponse(rule)).build();
    }
}
