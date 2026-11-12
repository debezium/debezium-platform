/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.io.BufferedReader;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

import jakarta.inject.Inject;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.SseEventSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.doc.FixFor;
import io.debezium.platform.MinimalDevServicesTestProfile;
import io.debezium.platform.domain.LogStreamingService;
import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.environment.logs.LogReader;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.RestAssured;

/**
 * Coverage for the SSE log stream (debezium/dbz#3004).
 * <p>
 * The log source is faked at the {@link LogReader} seam: the real {@link LogStreamingService}
 * plumbing still runs on a real virtual thread, so the tests exercise the actual hand-off between
 * the streaming task and the SSE response, while {@link PipelineService} is mocked to keep both
 * Kubernetes and the pipeline fixtures out of the picture.
 */
@QuarkusTest
@TestProfile(MinimalDevServicesTestProfile.class)
class PipelineLogStreamResourceIT {

    private static final Long PIPELINE_ID = 1L;
    private static final Long UNKNOWN_PIPELINE_ID = 999999L;

    /** Dequeued by {@link #fakeLogReader()} to mean the log has ended, i.e. {@code readLine()} returning {@code null}. */
    private static final String END_OF_LOG = "\u0000end-of-log\u0000";

    /** Dequeued by {@link #fakeLogReader()} to mean the next {@code readLine()} call fails instead of returning a line. */
    private static final String READ_FAILURE = "\u0000read-failure\u0000";

    @Inject
    LogStreamingService logStreamingService;

    @InjectMock
    PipelineService pipelineService;

    private final BlockingQueue<String> pendingLines = new LinkedBlockingQueue<>();
    private final AtomicBoolean logReaderClosed = new AtomicBoolean();
    private final AtomicReference<Throwable> reportedFailure = new AtomicReference<>();

    @BeforeEach
    void stubLogStreaming() {
        pendingLines.clear();
        logReaderClosed.set(false);
        reportedFailure.set(null);

        when(pipelineService.streamLogs(anyLong(), any(), any())).thenReturn(Optional.empty());
        when(pipelineService.streamLogs(eq(PIPELINE_ID), any(), any())).thenAnswer(invocation -> {
            Consumer<String> lineConsumer = invocation.getArgument(1);
            Consumer<Throwable> onFinished = invocation.getArgument(2);
            return Optional.of(logStreamingService.stream(
                    String.valueOf(PIPELINE_ID), this::fakeLogReader, lineConsumer, failure -> {
                        reportedFailure.set(failure);
                        onFinished.accept(failure);
                    }));
        });
    }

    @Test
    @FixFor("debezium/dbz#3004")
    @DisplayName("Every log line is delivered to the client as an SSE event, in order")
    void streamsEachLogLineAsAnSseEvent() {
        pendingLines.addAll(List.of("first log line", "second log line", "third log line"));

        List<String> receivedEvents = new CopyOnWriteArrayList<>();
        try (Client client = sseClient(); SseEventSource eventSource = SseEventSource.target(client.target(streamUri(PIPELINE_ID))).build()) {
            eventSource.register(event -> receivedEvents.add(event.readData()));
            eventSource.open();

            // The log is deliberately left "live" above (no END_OF_LOG queued): if it completed on its
            // own, the server ending the stream would race against the client closing it below, and
            // SseEventSource only skips its own reconnect if it is the one that wins that race.
            await().atMost(Duration.ofSeconds(15))
                    .until(() -> receivedEvents.size() == 3);
        }

        assertThat(receivedEvents).containsExactly("first log line", "second log line", "third log line");
    }

    @Test
    @FixFor("debezium/dbz#3004")
    @DisplayName("Disconnecting the client stops the underlying log stream")
    void stopsTheUnderlyingLogStreamWhenTheClientDisconnects() {
        pendingLines.add("a log line");

        List<String> receivedEvents = new CopyOnWriteArrayList<>();
        try (Client client = sseClient()) {
            try (SseEventSource eventSource = SseEventSource.target(client.target(streamUri(PIPELINE_ID))).build()) {
                eventSource.register(event -> receivedEvents.add(event.readData()));
                eventSource.open();

                // Only once a line has arrived is the streaming task known to be running, which is
                // what makes the assertion below about it stopping meaningful.
                await().atMost(Duration.ofSeconds(15)).until(() -> !receivedEvents.isEmpty());
            }
        }

        // The log-reading thread is left blocked waiting for a line that was never going to come, the
        // same way a real, still-running log would: closing the reader is what forces that wait to
        // give up (LogStreamingService.LogStreamingTask#stop()), which is what this actually verifies.
        await().atMost(Duration.ofSeconds(15))
                .untilAsserted(() -> assertThat(logReaderClosed).isTrue());
    }

    @Test
    @FixFor("debezium/dbz#3004")
    @DisplayName("The stream is closed when the log itself ends")
    void closesTheStreamWhenTheLogEnds() throws Exception {
        pendingLines.addAll(List.of("the last log line", END_OF_LOG));

        // Deliberately not an SseEventSource: that client reconnects when the server closes the
        // stream, which would hide the completion this test is about.
        HttpResponse<String> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(streamUri(PIPELINE_ID)))
                        .header("Accept", MediaType.SERVER_SENT_EVENTS)
                        .timeout(Duration.ofSeconds(15))
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("content-type")).hasValue(MediaType.SERVER_SENT_EVENTS);
        assertThat(response.body()).contains("data:the last log line", "event:log-stream-end", "data:the log has ended");
        assertThat(logReaderClosed).isTrue();
        assertThat(reportedFailure).hasValue(null);
    }

    @Test
    @FixFor("debezium/dbz#3004")
    @DisplayName("A failure reading the log fails the stream instead of closing it cleanly")
    void failsTheStreamWhenReadingTheLogFails() {
        pendingLines.add(READ_FAILURE);

        // Deliberately not an SseEventSource, and not asserting on the response at all: a real
        // failure resets the connection instead of ending it gracefully
        // (PipelineLogStreamResource#endStream), which this client surfaces as a failed request
        // rather than a complete, if empty, body (the java.net.http client discards whatever of the
        // body it had buffered when that happens, so the named failure event it carries is not
        // observable this way either). reportedFailure is what actually exercises that distinction,
        // by observing what LogStreamingTask reports regardless of how the client sees it.
        assertThatThrownBy(() -> HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(streamUri(PIPELINE_ID)))
                        .header("Accept", MediaType.SERVER_SENT_EVENTS)
                        .timeout(Duration.ofSeconds(15))
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString()))
                .isInstanceOf(IOException.class);

        await().atMost(Duration.ofSeconds(15))
                .untilAsserted(() -> assertThat(logReaderClosed).isTrue());
        assertThat(reportedFailure.get()).isInstanceOf(IOException.class);
    }

    @Test
    @FixFor("debezium/dbz#3004")
    @DisplayName("An unknown pipeline is rejected with 404 before the stream is committed")
    void returnsNotFoundForUnknownPipeline() {
        var response = given()
                .accept(MediaType.SERVER_SENT_EVENTS)
                .when()
                .get("/api/pipelines/{id}/logs/stream", UNKNOWN_PIPELINE_ID);

        // A 404 is only reachable while the response is uncommitted: the moment the first SSE event
        // is written the status is fixed at 200, and a browser EventSource is left reconnecting to a
        // pipeline that does not exist. The body proves the exception mapper, and not the stream,
        // produced this response.
        assertThat(response.statusCode()).isEqualTo(404);
        assertThat(response.body().asString()).contains("resource not found");
    }

    /**
     * Closing an {@link SseEventSource} blocks until its connection ends, so an endpoint that
     * delivers nothing and never completes would hang the build rather than fail it. The read
     * timeout bounds that: it is far longer than any wait these tests make on a healthy stream.
     */
    private static Client sseClient() {
        return ClientBuilder.newBuilder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build();
    }

    private static String streamUri(Long pipelineId) {
        return RestAssured.baseURI + ":" + RestAssured.port + "/api/pipelines/" + pipelineId + "/logs/stream";
    }

    /**
     * A log that yields whatever the test has queued, blocking for more the way a real, still-running
     * log does, until either {@link #END_OF_LOG} or {@link #READ_FAILURE} is queued, or {@code close()}
     * is called while that wait is blocked, the way {@link LogStreamingService.LogStreamingTask#stop()}
     * closes the real reader to force its own blocked read to give up.
     */
    private LogReader fakeLogReader() {
        return new LogReader() {
            private final AtomicReference<Thread> blockedReadingThread = new AtomicReference<>();

            @Override
            public String readLine() throws IOException {
                String line;
                blockedReadingThread.set(Thread.currentThread());
                try {
                    line = pendingLines.take();
                }
                catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IOException(e);
                }
                finally {
                    blockedReadingThread.set(null);
                }
                if (line.equals(END_OF_LOG)) {
                    return null;
                }
                if (line.equals(READ_FAILURE)) {
                    throw new IOException("simulated read failure");
                }
                return line;
            }

            @Override
            public String readAll() {
                return String.join("\n", pendingLines);
            }

            @Override
            public BufferedReader reader() {
                throw new UnsupportedOperationException("not used by the SSE stream");
            }

            @Override
            public void close() {
                logReaderClosed.set(true);
                Thread thread = blockedReadingThread.get();
                if (thread != null) {
                    thread.interrupt();
                }
            }
        };
    }
}
