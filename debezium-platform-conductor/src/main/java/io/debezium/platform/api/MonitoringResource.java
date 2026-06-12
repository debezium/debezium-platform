/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.enums.SchemaType;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import io.debezium.platform.data.dto.PanelQueryResponse;
import io.debezium.platform.data.dto.PanelsListResponse;
import io.debezium.platform.domain.MonitoringService;

@Path("monitoring")
@Tag(name = "Monitoring", description = "Pipeline monitoring and metrics")
public class MonitoringResource {

    private final MonitoringService monitoringService;

    public MonitoringResource(MonitoringService monitoringService) {
        this.monitoringService = monitoringService;
    }

    @Operation(summary = "List available monitoring panels")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = PanelsListResponse.class)))
    @GET
    @Path("/panels")
    @Produces(APPLICATION_JSON)
    public PanelsListResponse listPanels() {
        return monitoringService.listPanels();
    }

    @Operation(summary = "Query monitoring panel data for a specific pipeline")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = PanelQueryResponse.class)))
    @APIResponse(responseCode = "400", description = "Invalid parameters", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(type = SchemaType.OBJECT)))
    @APIResponse(responseCode = "404", description = "Panel not found", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(type = SchemaType.OBJECT)))
    @GET
    @Path("/panels/{id}/query")
    @Produces(APPLICATION_JSON)
    public PanelQueryResponse queryPanel(
                                         @PathParam("id") String panelId,
                                         @Parameter(required = true, description = "Pipeline identifier") @QueryParam("pipeline_id") @NotBlank @Pattern(regexp = "[a-zA-Z0-9_-]+") String pipelineId,
                                         @Parameter(required = true, description = "Start time (ISO 8601 or Unix timestamp)") @QueryParam("start") @NotBlank String start,
                                         @Parameter(required = true, description = "End time (ISO 8601 or Unix timestamp)") @QueryParam("end") @NotBlank String end,
                                         @Parameter(description = "Query resolution step (e.g. 15s, 1m)") @QueryParam("step") String step) {

        return monitoringService.queryPanel(panelId, pipelineId, start, end, step);
    }
}
