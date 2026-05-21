package io.debezium.platform.api;

import com.blazebit.persistence.integration.jaxrs.EntityViewId;
import io.debezium.platform.domain.DestinationService;
import io.debezium.platform.domain.views.Destination;
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

import java.net.URI;

import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;

@Tag(name = "destinations")
@OpenAPIDefinition(
        info = @Info(
                title = "Destination API",
                description = "CRUD operations over Destination resource",
                version = "0.1.0",
                contact = @Contact(name = "Debezium", url = "https://github.com/debezium/debezium")
        )
)
@Path("/destinations")
public class DestinationResource {

    Logger logger;
    DestinationService destinationService;

    public DestinationResource(Logger logger, DestinationService destinationService) {
        this.logger = logger;
        this.destinationService = destinationService;
    }

    @Operation(summary = "Returns all available destinations")
    @APIResponse(
            responseCode = "200",
            content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = Destination.class, required = true, type = SchemaType.ARRAY))
    )
    @GET
    public Response get() {
        var destinations = destinationService.list();
        return Response.ok(destinations).build();
    }

    @Operation(summary = "Returns a destination with given id")
    @APIResponse(
            responseCode = "200",
            content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = Destination.class, required = true))
    )
    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        return destinationService.findById(id)
                .map(destination -> Response.ok(destination).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }

    @Operation(summary = "Creates new destination")
    @APIResponse(
            responseCode = "201",
            content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = URI.class, required = true))
    )
    @POST
    public Response post(@NotNull @Valid Destination destination, @Context UriInfo uriInfo) {
        var created = destinationService.create(destination);
        URI uri = uriInfo.getAbsolutePathBuilder()
                .path(Long.toString(created.getId()))
                .build();
        return Response.created(uri).entity(created).build();
    }

    @Operation(summary = "Updates an existing destination")
    @APIResponse(
            responseCode = "200",
            content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = Destination.class, required = true))
    )
    @PUT
    @Path("/{id}")
    public Response put(@EntityViewId("id") @NotNull @Valid Destination destination) {
        var updated = destinationService.update(destination);
        return Response.ok(updated).build();
    }

    @Operation(summary = "Deletes an existing destination")
    @APIResponse(responseCode = "204")
    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        destinationService.delete(id);
        return Response.status(Response.Status.NO_CONTENT).build();
    }
}
