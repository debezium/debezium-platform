/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Semaphore;
import java.util.function.Consumer;

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

import io.debezium.platform.domain.LogStreamingService.LogStreamingTask;
import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.error.NotFoundException;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.subscription.MultiEmitter;

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
        // Looked up synchronously, off the event loop via @Blocking: RESTEasy commits the SSE
        // response as soon as this method returns, so a NotFoundException thrown once the Multi
        // below is subscribed to would only truncate the stream, not set a status code.
        Semaphore permits = new Semaphore(0);
        CompletableFuture<MultiEmitter<? super String>> emitter = new CompletableFuture<>();

        var task = pipelineService.streamLogs(id, emitPermittedLines(permits, emitter), completeStreamWhenReady(emitter))
                .orElseThrow(() -> new NotFoundException(id));

        return Multi.createFrom().<String> emitter(sink -> bridgeClientDemandToPermits(sink, task, permits, emitter))
                .map(line -> sse.newEventBuilder().data(line).build());
    }

    /**
     * RESTEasy Reactive's SSE writer requests one line at a time, only asking for the next once the
     * current one has actually been written to the client, so acquiring a permit per line blocks the
     * log-reading thread instead of piling lines up in memory when the client falls behind.
     */
    private static Consumer<String> emitPermittedLines(Semaphore permits, CompletableFuture<MultiEmitter<? super String>> emitter) {
        return line -> {
            permits.acquireUninterruptibly();
            emitter.join().emit(line);
        };
    }

    private static Runnable completeStreamWhenReady(CompletableFuture<MultiEmitter<? super String>> emitter) {
        return () -> emitter.join().complete();
    }

    private static void bridgeClientDemandToPermits(MultiEmitter<? super String> sink, LogStreamingTask task, Semaphore permits,
                                                    CompletableFuture<MultiEmitter<? super String>> emitter) {
        sink.onTermination(() -> {
            task.stop();
            // Unblocks a log-reading thread waiting on a permit a disconnected client will never grant.
            permits.release(Integer.MAX_VALUE / 2);
        });
        sink.onRequest(requested -> permits.release((int) requested));
        // Mutiny hands the subscriber its subscription, and so its initial request(1), before running
        // this lambda, silently dropping that first permit rather than passing it to onRequest above.
        // Nothing has emitted yet to consume it, so granting it here can't double count it.
        permits.release((int) sink.requested());
        emitter.complete(sink);
    }
}
