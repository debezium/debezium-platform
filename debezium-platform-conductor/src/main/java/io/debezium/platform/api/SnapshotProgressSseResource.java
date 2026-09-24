/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import io.debezium.platform.api.dto.SnapshotProgressResponse;
import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.domain.snapshot.SnapshotProgressAggregator;
import io.debezium.platform.error.NotFoundException;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;

/**
 * Snapshot progress surfaces for a pipeline (DDD-68): a non-streaming current-state endpoint
 * and an SSE stream of full-state updates. Each SSE event is a named
 * {@code snapshot-progress} event carrying the complete {@link SnapshotProgressResponse}; the first
 * event on connect is always the current state, and the IDLE payload is used when no
 * snapshot is active.
 */
@Tag(name = "snapshots")
@Path("/pipelines/{pipelineId}/snapshots")
public class SnapshotProgressSseResource {

    private static final String EVENT_NAME = "snapshot-progress";

    private final SnapshotProgressAggregator aggregator;
    private final PipelineService pipelineService;

    public SnapshotProgressSseResource(SnapshotProgressAggregator aggregator, PipelineService pipelineService) {
        this.aggregator = aggregator;
        this.pipelineService = pipelineService;
    }

    @GET
    @Path("/progress")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Current snapshot progress for a pipeline (non-streaming)")
    public Response current(@PathParam("pipelineId") Long pipelineId) {
        if (pipelineService.findById(pipelineId).isEmpty()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(aggregator.currentState(pipelineId)).build();
    }

    @GET
    @Path("/progress/stream")
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @Operation(summary = "Stream live snapshot progress for a pipeline via SSE")
    public Multi<OutboundSseEvent> stream(@PathParam("pipelineId") Long pipelineId, @Context Sse sse) {
        // Read the initial state lazily, at subscription time, so the window between reading it and the
        // broadcaster becoming subscribed (during which a broadcast would otherwise be dropped) is kept
        // as small as possible. Every event is a full-state snapshot, so a later update simply supersedes.
        // currentState() is @Transactional (it hits the database), so it must run on a worker thread: this
        // Multi is subscribed on the reactive event loop, where starting a JTA transaction is forbidden.
        // The pipeline-existence check is @Transactional too, so it shares that worker-thread hop and fails
        // the stream with a 404 (via NotFoundException) before any SSE event is emitted when the pipeline
        // does not exist.
        Multi<SnapshotProgressResponse> initial = Uni.createFrom()
                .item(() -> {
                    if (pipelineService.findById(pipelineId).isEmpty()) {
                        throw new NotFoundException(pipelineId);
                    }
                    return aggregator.currentState(pipelineId);
                })
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool())
                .toMulti();
        return Multi.createBy().concatenating().streams(
                initial,
                aggregator.subscribe(pipelineId))
                .map(state -> sse.newEventBuilder()
                        .name(EVENT_NAME)
                        .mediaType(MediaType.APPLICATION_JSON_TYPE)
                        .data(SnapshotProgressResponse.class, state)
                        .build());
    }
}
