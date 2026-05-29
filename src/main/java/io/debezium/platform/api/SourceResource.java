package io.debezium.platform.api;

import com.blazebit.persistence.integration.jaxrs.EntityViewId;
import io.debezium.platform.domain.SourceService;
import io.debezium.platform.domain.views.Source;
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

@Tag(name = "sources")
@OpenAPIDefinition(
        info = @Info(
                title = "Source API",
                description = "CRUD operations over Source resource",
                version = "0.1.0",
                contact = @Contact(name = "Debezium", url = "https://github.com/debezium/debezium")
        )
)
@Path("/sources")
public class SourceResource {

    Logger logger;
    SourceService sourceService;

    public SourceResource(Logger logger, SourceService sourceService) {
        this.logger = logger;
        this.sourceService = sourceService;
    }

    @Operation(summary = "Returns all available sources")
    @APIResponse(
            responseCode = "200",
            content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = Source.class, required = true, type = SchemaType.ARRAY))
    )
    @GET
    public Response get() {
        var sources = sourceService.list();
        return Response.ok(sources).build();
    }

    @Operation(summary = "Returns a source with given id")
    @APIResponse(
            responseCode = "200",
            content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = Source.class, required = true))
    )
    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        return sourceService.findById(id)
                .map(source -> Response.ok(source).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }

    @Operation(summary = "Creates new source")
    @APIResponse(
            responseCode = "201",
            content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = URI.class, required = true))
    )
    @POST
    public Response post(@NotNull @Valid Source source, @Context UriInfo uriInfo) {
        var created = sourceService.create(source);
        URI uri = uriInfo.getAbsolutePathBuilder()
                .path(Long.toString(created.getId()))
                .build();
        return Response.created(uri).entity(created).build();
    }

    @Operation(summary = "Updates an existing source")
    @APIResponse(
            responseCode = "200",
            content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = Source.class, required = true))
    )
    @PUT
    @Path("/{id}")
    public Response put(@EntityViewId("id") @NotNull @Valid Source source) {
        var updated = sourceService.update(source);
        return Response.ok(updated).build();
    }

    @Operation(summary = "Deletes an existing source")
    @APIResponse(responseCode = "204")
    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") Long id) {
        sourceService.delete(id);
        return Response.status(Response.Status.NO_CONTENT).build();
    }
}
