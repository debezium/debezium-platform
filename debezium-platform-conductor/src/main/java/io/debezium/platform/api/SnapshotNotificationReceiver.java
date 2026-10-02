/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.jboss.logging.Logger;

import io.debezium.platform.api.dto.SnapshotNotificationRequest;
import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.domain.snapshot.SnapshotProgressAggregator;

/**
 * Internal ingestion endpoint for Debezium snapshot notifications (DDD-68). Debezium Server
 * instances post here via the Conductor's in-cluster Service DNS; the Ingress must deny external
 * access to {@code /api/internal/*} (see the Helm ingress template). Returns {@code 202} immediately;
 * aggregation is synchronous but cheap.
 */
@Path("/internal/pipelines/{pipelineId}/notifications")
public class SnapshotNotificationReceiver {

    private final Logger logger;
    private final SnapshotProgressAggregator aggregator;
    private final PipelineService pipelineService;

    public SnapshotNotificationReceiver(Logger logger, SnapshotProgressAggregator aggregator,
                                        PipelineService pipelineService) {
        this.logger = logger;
        this.aggregator = aggregator;
        this.pipelineService = pipelineService;
    }

    @POST
    @Consumes(APPLICATION_JSON)
    @Operation(hidden = true)
    public Response ingest(@PathParam("pipelineId") Long pipelineId,
                           @NotNull @Valid SnapshotNotificationRequest notification) {
        if (pipelineService.findById(pipelineId).isEmpty()) {
            logger.debugf("Rejecting snapshot notification for unknown pipeline %d", pipelineId);
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        aggregator.accept(pipelineId, notification);
        return Response.status(Response.Status.ACCEPTED).build();
    }
}
