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

import com.blazebit.persistence.integration.jaxrs.EntityViewId;

import io.debezium.platform.domain.VaultService;
import io.debezium.platform.domain.views.Vault;

@Tag(name = "vaults")
@OpenAPIDefinition(info = @Info(title = "Vault API", description = "CRUD operations over Source revault", version = "0.1.0", contact = @Contact(name = "Debezium", url = "https://github.com/debezium/debezium")))
@Path("/vaults")
public class VaultResource {

    Logger logger;
    VaultService vaultService;

    public VaultResource(Logger logger, VaultService vaultService) {
        this.logger = logger;
        this.vaultService = vaultService;
    }

    @Operation(summary = "Returns all available vaults")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = Vault.class, required = true, type = SchemaType.ARRAY)))
    @GET
    public Response get() {
        var vaults = vaultService.list();
        return Response.ok(vaults).build();
    }

    @Operation(summary = "Returns a vault with given id")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = Vault.class, required = true)))
    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        return vaultService.findById(id)
                .map(vault -> Response.ok(vault).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }

    @Operation(summary = "Creates new vault")
    @APIResponse(responseCode = "201", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = URI.class, required = true)))
    @POST
    public Response post(@NotNull @Valid Vault vault, @Context UriInfo uriInfo) {
        var created = vaultService.create(vault);
        URI uri = uriInfo.getAbsolutePathBuilder()
                .path(Long.toString(created.getId()))
                .build();
        return Response.created(uri).entity(created).build();
    }

    @Operation(summary = "Updates an existing vault")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = Vault.class, required = true)))
    @PUT
    @Path("/{id}")
    public Response put(@EntityViewId("id") @NotNull @Valid Vault vault) {
        var updated = vaultService.update(vault);
        return Response.ok(updated).build();
    }

    @Operation(summary = "Deletes an existing vault")
    @APIResponse(responseCode = "204")
    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        vaultService.delete(id);
        return Response.status(Response.Status.NO_CONTENT).build();
    }
}
