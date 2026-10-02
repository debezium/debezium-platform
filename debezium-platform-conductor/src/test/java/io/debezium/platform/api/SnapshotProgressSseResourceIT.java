/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.SseEventSource;

import org.junit.jupiter.api.Test;

import io.debezium.doc.FixFor;
import io.debezium.platform.data.model.PipelineEntity;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;

/**
 * Regression coverage for {@link SnapshotProgressSseResource#stream}. The returned {@code Multi} is
 * subscribed on the reactive event loop, and its first event is the current state read from the
 * database under a JTA transaction. Performing that read on the event loop throws
 * {@code BlockingOperationNotAllowedException}, so no event ever reaches the client. This test opens a
 * real SSE client and asserts the first (IDLE) event is delivered on connect, proving the initial read
 * runs on a worker thread.
 */
@QuarkusTest
class SnapshotProgressSseResourceIT {

    @Inject
    EntityManager em;

    @Inject
    UserTransaction tx;

    @Test
    @FixFor("debezium/dbz#2536")
    void streamDeliversInitialStateEventOnConnect() throws Exception {
        Long pipelineId = seedPipeline();

        String streamUri = RestAssured.baseURI + ":" + RestAssured.port
                + "/api/pipelines/" + pipelineId + "/snapshots/progress/stream";

        Client client = ClientBuilder.newClient();
        try {
            WebTarget target = client.target(streamUri);
            CompletableFuture<String> firstEvent = new CompletableFuture<>();
            try (SseEventSource eventSource = SseEventSource.target(target).build()) {
                eventSource.register(
                        event -> firstEvent.complete(event.readData()),
                        firstEvent::completeExceptionally);
                eventSource.open();

                String data = firstEvent.get(15, TimeUnit.SECONDS);
                assertThat(data).contains("\"status\":\"IDLE\"");
            }
        }
        finally {
            client.close();
        }
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void currentReturnsNotFoundForUnknownPipeline() {
        given()
                .when()
                .get("/api/pipelines/{pipelineId}/snapshots/progress", 999999L)
                .then()
                .statusCode(404);
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void streamReturnsNotFoundForUnknownPipeline() {
        given()
                .accept(MediaType.SERVER_SENT_EVENTS)
                .when()
                .get("/api/pipelines/{pipelineId}/snapshots/progress/stream", 999999L)
                .then()
                .statusCode(404);
    }

    private Long seedPipeline() throws Exception {
        tx.begin();
        try {
            PipelineEntity pipeline = new PipelineEntity();
            pipeline.setName("it-sse-stream-pipeline");
            em.persist(pipeline);
            em.flush();
            Long id = pipeline.getId();
            tx.commit();
            return id;
        }
        catch (Exception exception) {
            tx.rollback();
            throw exception;
        }
    }
}
