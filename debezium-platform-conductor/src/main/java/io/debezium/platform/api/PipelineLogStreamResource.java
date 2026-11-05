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
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.error.NotFoundException;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.UnicastProcessor;

/**
 * Live pipeline logs as a Server-Sent Events stream (debezium/dbz#3004). This replaces the
 * previous WebSocket endpoint: log streaming is strictly server-to-client, and being plain HTTP
 * the stream goes through the same filters, headers and proxies as every other endpoint, with no
 * upgrade handshake to work around.
 *
 * <p>Each log line is sent as the data of one unnamed SSE event.
 */
@Tag(name = "pipelines")
@Path("/pipelines/{id}/logs/stream")
public class PipelineLogStreamResource {

    private final PipelineService pipelineService;

    public PipelineLogStreamResource(PipelineService pipelineService) {
        this.pipelineService = pipelineService;
    }

    @GET
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @Blocking
    @Operation(summary = "Stream live logs for the pipeline with the given id via SSE")
    @APIResponse(responseCode = "200", description = "Stream of events, each carrying a single log line", content = @Content(mediaType = MediaType.SERVER_SENT_EVENTS, schema = @Schema(implementation = String.class, required = true)))
    @APIResponse(responseCode = "404", description = "Unknown pipeline")
    public Multi<OutboundSseEvent> stream(@PathParam("id") Long id, @Context Sse sse) {
        // Both the existence check and the start of the stream must happen here, synchronously, and
        // not at subscription time: RESTEasy commits the SSE response (200, chunked) as soon as this
        // method returns, so a NotFoundException raised later can no longer set a status code and
        // would merely truncate the stream. Looking the pipeline up hits the database, hence
        // @Blocking: it keeps this method off the reactive event loop, where starting a JTA
        // transaction is forbidden.
        UnicastProcessor<String> lines = UnicastProcessor.create();
        // The task has to outlive this method, which only returns the stream that RESTEasy then
        // subscribes to: stopping it anywhere in here serves the client an empty stream that never
        // completes. It is stopped from onTermination below instead.
        var task = pipelineService.streamLogs(id, lines::onNext, lines::onComplete)
                .orElseThrow(() -> new NotFoundException(id));

        // The processor buffers anything the streaming task produces between here and the
        // subscription that RESTEasy makes once the response is committed, so no line is lost.
        // onTermination covers completion, failure and the cancellation that a client disconnect
        // raises, so the task is stopped on every path out of the stream.
        return lines
                .onTermination().invoke(task::stop)
                .map(line -> sse.newEventBuilder().data(line).build());
    }
}
