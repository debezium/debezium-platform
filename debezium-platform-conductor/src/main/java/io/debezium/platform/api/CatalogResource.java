/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.enums.SchemaType;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;

import io.debezium.platform.config.security.Permissions;
import io.debezium.platform.domain.CatalogService;
import io.quarkus.security.PermissionsAllowed;

@Path("catalog")
public class CatalogResource {

    private final CatalogService catalogService;

    @ConfigProperty(name = "quarkus.application.version")
    String applicationVersion;

    public CatalogResource(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @Operation(summary = "Returns all available components for the current application version")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(required = true, type = SchemaType.OBJECT)))
    @PermissionsAllowed(Permissions.CATALOG_READ)
    @GET
    @Produces("application/json")
    public Response getCatalog(@QueryParam("type") String componentType) {
        return Response.status(200)
                .entity(catalogService.getCatalog(applicationVersion, componentType))
                .build();
    }

    @Operation(summary = "Returns all available components for a specific version")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(required = true, type = SchemaType.OBJECT)))
    @PermissionsAllowed(Permissions.CATALOG_READ)
    @GET
    @Produces("application/json")
    @Path("/{version}")
    public Response getCatalog(@PathParam("version") String version, @QueryParam("type") String componentType) {

        return Response.status(200)
                .entity(catalogService.getCatalog(version, componentType))
                .build();
    }

    @Operation(summary = "Returns descriptors for a specific component using current application version")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(required = true, type = SchemaType.OBJECT)))
    @PermissionsAllowed(Permissions.CATALOG_READ)
    @GET
    @Produces("application/json")
    @Path("/{type}/{class}")
    public Response getComponentDescriptor(@PathParam("type") String componentType,
                                           @PathParam("class") String componentClass) {
        return Response.status(200)
                .entity(catalogService.getComponentDescriptor(applicationVersion, componentType, componentClass))
                .build();
    }

    @Operation(summary = "Returns descriptors for a specific component")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(required = true, type = SchemaType.OBJECT)))
    @PermissionsAllowed(Permissions.CATALOG_READ)
    @GET
    @Produces("application/json")
    @Path("/{version}/{type}/{class}")
    public Response getComponentDescriptor(@PathParam("version") String version,
                                           @PathParam("type") String componentType,
                                           @PathParam("class") String componentClass) {

        return Response.status(200)
                .entity(catalogService.getComponentDescriptor(version, componentType, componentClass))
                .build();
    }
}
