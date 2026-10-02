/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;

import java.time.Instant;

import jakarta.validation.constraints.Max;
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

import io.debezium.connector.SnapshotType;
import io.debezium.platform.api.dto.PagedSnapshotHistoryResponse;
import io.debezium.platform.api.dto.SnapshotHistoryResponse;
import io.debezium.platform.data.model.SnapshotState;
import io.debezium.platform.domain.SnapshotHistoryService;

/**
 * Snapshot history query surfaces for a pipeline (DDD-68): a paginated, filterable list and a
 * single-run detail endpoint with the per-table breakdown.
 */
@Tag(name = "snapshots")
@Path("/pipelines/{pipelineId}/snapshots/history")
public class SnapshotHistoryResource {

    private final SnapshotHistoryService historyService;

    public SnapshotHistoryResource(SnapshotHistoryService historyService) {
        this.historyService = historyService;
    }

    @Operation(summary = "List completed snapshot runs for a pipeline (paginated)")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = PagedSnapshotHistoryResponse.class, required = true)))
    @GET
    public Response list(@PathParam("pipelineId") Long pipelineId,
                         @QueryParam("type") SnapshotType type,
                         @QueryParam("outcome") SnapshotState outcome,
                         @QueryParam("from") Instant from,
                         @QueryParam("to") Instant to,
                         @QueryParam("page") @DefaultValue("0") @Min(0) int page,
                         @QueryParam("size") @DefaultValue("20") @Min(1) @Max(100) int size) {
        var result = historyService.query(pipelineId, type, outcome, from, to, page, size);
        return Response.ok(result).build();
    }

    @Operation(summary = "Return a single snapshot run with its per-table breakdown")
    @APIResponse(responseCode = "200", content = @Content(mediaType = APPLICATION_JSON, schema = @Schema(implementation = SnapshotHistoryResponse.class, required = true)))
    @APIResponse(responseCode = "404", description = "Unknown snapshot run for this pipeline")
    @GET
    @Path("/{historyId}")
    public Response getById(@PathParam("pipelineId") Long pipelineId, @PathParam("historyId") Long historyId) {
        return historyService.findRunById(historyId)
                .filter(run -> run.pipelineId().equals(pipelineId))
                .map(run -> Response.ok(run).build())
                .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
    }
}
