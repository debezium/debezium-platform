/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import java.time.Duration;
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
 * <p>Each log line is sent as the data of one unnamed SSE event. The stream ending, whether the log
 * itself ended or it could not be read, is instead reported as one named "{@value #END_EVENT_NAME}"
 * or "{@value #FAILURE_EVENT_NAME}" event: a client that tells either apart from a log line can
 * close the connection itself and decide for itself whether, and when, to reconnect, rather than
 * relying on the reconnect every client falls back to otherwise, which would start a new task and
 * re-read the log from wherever its source starts it from (its very beginning for a host deployment,
 * or its last 100 lines for a Kubernetes one), duplicating lines already seen.
 */
@Tag(name = "pipelines")
@Path("/pipelines/{id}/logs/stream")
public class PipelineLogStreamResource {

    private static final String END_EVENT_NAME = "log-stream-end";

    private static final String FAILURE_EVENT_NAME = "log-stream-failure";

    private static final long FAILURE_RECONNECT_DELAY_MILLIS = Duration.ofSeconds(15).toMillis();

    private final PipelineService pipelineService;

    public PipelineLogStreamResource(PipelineService pipelineService) {
        this.pipelineService = pipelineService;
    }

    @GET
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @Blocking
    @Operation(summary = "Stream live logs for the pipeline with the given id via SSE")
    @APIResponse(responseCode = "200", description = "Stream of events, each carrying a single log line, followed by a named \"" + END_EVENT_NAME
            + "\" or \"" + FAILURE_EVENT_NAME
            + "\" event once the stream ends", content = @Content(mediaType = MediaType.SERVER_SENT_EVENTS, schema = @Schema(implementation = String.class, required = true)))
    @APIResponse(responseCode = "404", description = "Unknown pipeline")
    public Multi<OutboundSseEvent> stream(@PathParam("id") Long id, @Context Sse sse) {
        // Looked up synchronously, off the event loop via @Blocking: RESTEasy commits the SSE
        // response as soon as this method returns, so a NotFoundException thrown once the Multi
        // below is subscribed to would only truncate the stream, not set a status code.
        Semaphore permits = new Semaphore(0);
        CompletableFuture<MultiEmitter<? super OutboundSseEvent>> emitter = new CompletableFuture<>();

        var task = pipelineService.streamLogs(id, emitPermittedLines(sse, permits, emitter), endStream(sse, permits, emitter))
                .orElseThrow(() -> new NotFoundException(id));

        return Multi.createFrom().emitter(sink -> bridgeClientDemandToPermits(sink, task, permits, emitter));
    }

    /**
     * RESTEasy Reactive's SSE writer requests one line at a time, only asking for the next once the
     * current one has actually been written to the client, so acquiring a permit per line blocks the
     * log-reading thread instead of piling lines up in memory when the client falls behind.
     */
    private static Consumer<String> emitPermittedLines(Sse sse, Semaphore permits, CompletableFuture<MultiEmitter<? super OutboundSseEvent>> emitter) {
        return line -> {
            permits.acquireUninterruptibly();
            emitter.join().emit(sse.newEventBuilder().data(line).build());
        };
    }

    /**
     * Either way the stream ends, the client first gets a named event it can use to tell a log that
     * has genuinely ended, or failed, apart from one merely falling silent for a while, and so decide
     * for itself whether to reconnect. A real failure also carries a reconnect delay, as a fallback
     * for whatever client does not act on the named event itself (unlike a browser EventSource, the
     * JAX-RS SseEventSource used elsewhere in this codebase only auto-reconnects after a clean
     * completion, not after a failure), so one that retries anyway does not immediately hammer the
     * pipeline again.
     */
    private static Consumer<Throwable> endStream(Sse sse, Semaphore permits, CompletableFuture<MultiEmitter<? super OutboundSseEvent>> emitter) {
        return failure -> {
            MultiEmitter<? super OutboundSseEvent> sink = emitter.join();
            OutboundSseEvent terminalEvent = failure == null
                    ? sse.newEventBuilder().name(END_EVENT_NAME).data("the log has ended").build()
                    : sse.newEventBuilder().name(FAILURE_EVENT_NAME).data("the log could not be read").reconnectDelay(FAILURE_RECONNECT_DELAY_MILLIS).build();

            permits.acquireUninterruptibly();
            sink.emit(terminalEvent);
            awaitEmission(permits);

            if (failure == null) {
                sink.complete();
            }
            else {
                sink.fail(failure);
            }
        };
    }

    /**
     * Blocks until one more permit is granted, as proof that the previous emission was actually
     * written: a permit is only ever granted once RESTEasy's write of the one before it completes.
     * The permit itself goes unused here; ending the stream (complete or fail) right after an emit
     * would otherwise reset or close the connection, racing with, and risking discarding, it.
     */
    private static void awaitEmission(Semaphore permits) {
        permits.acquireUninterruptibly();
    }

    private static void bridgeClientDemandToPermits(MultiEmitter<? super OutboundSseEvent> sink, LogStreamingTask task, Semaphore permits,
                                                    CompletableFuture<MultiEmitter<? super OutboundSseEvent>> emitter) {
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
