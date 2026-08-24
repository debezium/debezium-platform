/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;

import java.time.Instant;

import jakarta.validation.constraints.Min;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.logging.Logger;

import io.debezium.platform.api.dto.AlertEventResponse;
import io.debezium.platform.api.dto.AlertStatusResponse;
import io.debezium.platform.api.dto.PagedAlertEventResponse;
import io.debezium.platform.data.model.Severity;
import io.debezium.platform.domain.AlertEventService;
import io.debezium.platform.domain.AlertStateService;

@Tag(name = "Alerting")
@Path("/alerts")
public class AlertEventResource {

    Logger logger;
    AlertEventService alertEventService;
    AlertStateService alertStateService;

    public AlertEventResource(Logger logger, AlertEventService alertEventService,
                              AlertStateService alertStateService) {
        this.logger = logger;
        this.alertEventService = alertEventService;
        this.alertStateService = alertStateService;
    }

    @Operation(summary = "Returns paginated alert events")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = PagedAlertEventResponse.class, required = true)))
    @GET
    @Path("/events")
    public Response listEvents(@QueryParam("severity") Severity severity,
                               @QueryParam("status") String status,
                               @QueryParam("pipelineId") String pipelineId,
                               @QueryParam("ruleId") Long ruleId,
                               @QueryParam("from") Instant from,
                               @QueryParam("to") Instant to,
                               @QueryParam("page") @DefaultValue("0") @Min(0) int page,
                               @QueryParam("size") @DefaultValue("20") @Min(1) int size) {
        var result = alertEventService.listEvents(severity, status, pipelineId, ruleId, from, to, page, size);
        return Response.ok(result).build();
    }

    @Operation(summary = "Returns a single alert event by id")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = AlertEventResponse.class, required = true)))
    @GET
    @Path("/events/{id}")
    public Response getEventById(@PathParam("id") Long id) {
        return alertEventService.findEventById(id)
                .map(dto -> Response.ok(dto).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }

    @Operation(summary = "Returns current alert status summary")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = AlertStatusResponse.class, required = true)))
    @GET
    @Path("/status")
    public Response getStatus() {
        var result = alertStateService.getStatus();
        return Response.ok(result).build();
    }
}
