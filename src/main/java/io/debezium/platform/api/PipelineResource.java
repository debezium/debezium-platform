package io.debezium.platform.api;

import com.blazebit.persistence.integration.jaxrs.EntityViewId;
import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.domain.views.Pipeline;
import io.debezium.platform.environment.EnvironmentController;
import io.debezium.platform.environment.logs.LogReader;
import io.smallrye.common.annotation.RunOnVirtualThread;
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

import java.net.URI;

import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;
import static jakarta.ws.rs.core.MediaType.TEXT_PLAIN;

@Tag(name = "pipelines")
@OpenAPIDefinition(
        info = @Info(
                title = "Pipeline API",
                description = "CRUD operations over Pipeline resource",
                version = "0.1.0",
                contact = @Contact(name = "Debezium", url = "https://github.com/debezium/debezium")
        )
)
@Path("/pipelines")
public class PipelineResource {

    Logger logger;
    PipelineService pipelineService;

    public PipelineResource(Logger logger, PipelineService pipelineService) {
        this.logger = logger;
        this.pipelineService = pipelineService;
    }

    @Operation(summary = "Returns all available pipelines")
    @APIResponse(
            responseCode = "200",
            content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = Pipeline.class, required = true, type = SchemaType.ARRAY))
    )
    @GET
    public Response get() {
        var pipelines = pipelineService.list();
        return Response.ok(pipelines).build();
    }

    @Operation(summary = "Returns a pipeline with given id")
    @APIResponse(
            responseCode = "200",
            content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = Pipeline.class, required = true))
    )
    @GET
    @Path("/{id}")
    public Response getById(@PathParam("id") Long id) {
        return pipelineService.findById(id)
                .map(source -> Response.ok(source).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }

    @Operation(summary = "Creates new pipeline")
    @APIResponse(
            responseCode = "201",
            content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = URI.class, required = true))
    )
    @POST
    public Response post(@NotNull @Valid Pipeline pipeline, @Context UriInfo uriInfo) {
        var created = pipelineService.create(pipeline);
        URI uri = uriInfo.getAbsolutePathBuilder()
                .path(Long.toString(created.getId()))
                .build();
        return Response.created(uri).entity(created).build();
    }

    @Operation(summary = "Updates an existing pipeline")
    @APIResponse(
            responseCode = "200",
            content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = Pipeline.class, required = true))
    )
    @PUT
    @Path("/{id}")
    public Response put(@EntityViewId("id") @NotNull @Valid Pipeline pipeline) {
        var updated = pipelineService.update(pipeline);
        return Response.ok(updated).build();
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
    @APIResponse(
            responseCode = "200",
            content = @Content(mediaType = TEXT_PLAIN, schema = @Schema(implementation = String.class, required = true))
    )
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
}
