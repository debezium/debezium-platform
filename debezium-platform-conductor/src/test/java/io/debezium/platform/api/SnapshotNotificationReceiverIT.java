/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static jakarta.ws.rs.core.MediaType.APPLICATION_JSON;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;

import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import io.debezium.doc.FixFor;
import io.debezium.platform.data.model.PipelineEntity;
import io.debezium.platform.domain.snapshot.SnapshotNotifications;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.ValidatableResponse;

/**
 * End-to-end integration tests for {@link SnapshotNotificationReceiver} (DDD-68). A posted
 * notification flows through the aggregator into the active tier and is reflected by the one-shot
 * progress endpoint. The main test drives a whole snapshot lifecycle so every notification type the
 * aggregator handles is exercised over HTTP &mdash; STARTED, chunk progress (both the
 * {@code IN_PROGRESS} and {@code TABLE_CHUNK_IN_PROGRESS} spellings), table completion (both
 * {@code TABLE_SCAN_COMPLETED} and {@code TABLE_CHUNK_COMPLETED}), PAUSED/RESUMED, and each of the
 * three terminals (COMPLETED, ABORTED, SKIPPED) &mdash; plus the receiver-level validation of the
 * target pipeline (404) and request body (400) and the graceful handling of ignored notifications.
 */
@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class SnapshotNotificationReceiverIT {

    private static final String PIPELINE_NAME = "it-snapshot-receiver-pipeline";
    private static final Long UNKNOWN_PIPELINE_ID = 987654321L;
    private static final long T0 = 1_758_535_200_000L;

    static Long pipelineId;

    @Inject
    EntityManager em;

    @Inject
    UserTransaction tx;

    private static String notificationsPath(Long id) {
        return "api/internal/pipelines/" + id + "/notifications";
    }

    private static String progressPath(Long id) {
        return "api/pipelines/" + id + "/snapshots/progress";
    }

    private static String historyPath(Long id) {
        return "api/pipelines/" + id + "/snapshots/history";
    }

    @Test
    @Order(0)
    void seedPipeline() throws Exception {
        tx.begin();
        try {
            PipelineEntity pipeline = new PipelineEntity();
            pipeline.setName(PIPELINE_NAME);
            em.persist(pipeline);
            em.flush();
            pipelineId = pipeline.getId();
            tx.commit();
        }
        catch (Exception e) {
            tx.rollback();
            throw e;
        }
    }

    @Test
    @Order(1)
    @FixFor("debezium/dbz#2536")
    void progressIsIdleBeforeAnySnapshot() {
        progress()
                .body("status", is("IDLE"))
                .body("type", nullValue())
                .body("tables", hasSize(0));
    }

    @Test
    @Order(2)
    @FixFor("debezium/dbz#2536")
    void notificationForUnknownPipelineReturnsNotFound() {
        given()
                .contentType(APPLICATION_JSON)
                .body(notification("n-404", SnapshotNotifications.STARTED, "{}", T0))
                .when().post(notificationsPath(UNKNOWN_PIPELINE_ID))
                .then()
                .statusCode(404);
    }

    @Test
    @Order(3)
    @FixFor("debezium/dbz#2536")
    void invalidNotificationBodyReturnsBadRequest() {
        given()
                .contentType(APPLICATION_JSON)
                .body("{}")
                .when().post(notificationsPath(pipelineId))
                .then()
                .statusCode(400);
    }

    @Test
    @Order(4)
    @FixFor("debezium/dbz#2536")
    void startedCreatesActiveSnapshotWithReportedTables() {
        accept(notification("n-started", SnapshotNotifications.STARTED,
                additionalData(SnapshotNotifications.K_DATA_COLLECTIONS, "[inventory.orders, inventory.products]"),
                T0));

        progress()
                .body("status", is("RUNNING"))
                .body("type", is("INITIAL"))
                .body("globalProgress.totalTables", is(2))
                .body("globalProgress.completedTables", is(0))
                .body("tables", hasSize(2))
                .body("tables.name", containsInAnyOrder("inventory.orders", "inventory.products"));
    }

    @Test
    @Order(5)
    @FixFor("debezium/dbz#2536")
    void chunkProgressMarksTableInProgress() {
        accept(notification("n-chunk-1", SnapshotNotifications.IN_PROGRESS,
                additionalData(
                        SnapshotNotifications.K_CURRENT_COLLECTION, "inventory.orders",
                        SnapshotNotifications.K_CHUNK_INDEX, "2",
                        SnapshotNotifications.K_TOTAL_CHUNKS, "10",
                        SnapshotNotifications.K_ROWS_SCANNED, "2000"),
                T0 + 60_000));

        progress()
                .body("status", is("RUNNING"))
                .body("tables[0].name", is("inventory.orders"))
                .body("tables[0].status", is("IN_PROGRESS"))
                .body("tables[0].progress.chunkIndex", is(2))
                .body("tables[0].progress.totalChunks", is(10))
                .body("tables[0].progress.percentage", is(20.0f))
                .body("tables[0].rowsScanned", is(2000));
    }

    @Test
    @Order(6)
    @FixFor("debezium/dbz#2536")
    void tableChunkInProgressAliasUpdatesOverlay() {
        // TABLE_CHUNK_IN_PROGRESS is handled by the same branch as IN_PROGRESS; a newer chunk supersedes.
        accept(notification("n-chunk-2", SnapshotNotifications.TABLE_CHUNK_IN_PROGRESS,
                additionalData(
                        SnapshotNotifications.K_CURRENT_COLLECTION, "inventory.orders",
                        SnapshotNotifications.K_CHUNK_INDEX, "5",
                        SnapshotNotifications.K_TOTAL_CHUNKS, "10",
                        SnapshotNotifications.K_ROWS_SCANNED, "4000"),
                T0 + 120_000));

        progress()
                .body("tables[0].progress.chunkIndex", is(5))
                .body("tables[0].progress.percentage", is(50.0f))
                .body("tables[0].rowsScanned", is(4000));
    }

    @Test
    @Order(7)
    @FixFor("debezium/dbz#2536")
    void tableScanCompletedMarksTableCompleted() {
        accept(notification("n-orders-done", SnapshotNotifications.TABLE_SCAN_COMPLETED,
                additionalData(
                        SnapshotNotifications.K_SCANNED_COLLECTION, "inventory.orders",
                        SnapshotNotifications.K_ROWS_SCANNED, "5000",
                        SnapshotNotifications.K_STATUS, "SUCCEEDED"),
                T0 + 180_000));

        progress()
                .body("globalProgress.completedTables", is(1))
                .body("globalProgress.percentage", is(50.0f))
                .body("tables[0].status", is("COMPLETED"))
                .body("tables[0].rowsScanned", is(5000))
                .body("tables[0].progress", nullValue());
    }

    @Test
    @Order(8)
    @FixFor("debezium/dbz#2536")
    void emptyTableChunkCompletedMapsToSkipped() {
        // TABLE_CHUNK_COMPLETED is handled by the same branch as TABLE_SCAN_COMPLETED.
        accept(notification("n-products-done", SnapshotNotifications.TABLE_CHUNK_COMPLETED,
                additionalData(
                        SnapshotNotifications.K_SCANNED_COLLECTION, "inventory.products",
                        SnapshotNotifications.K_STATUS, "EMPTY"),
                T0 + 240_000));

        progress()
                .body("globalProgress.completedTables", is(1))
                .body("totalRowsScanned", is(5000))
                .body("tables[1].name", is("inventory.products"))
                .body("tables[1].status", is("SKIPPED"))
                .body("tables[1].skipReason", is("Table is empty"))
                .body("tables[1].rowsScanned", is(0));
    }

    @Test
    @Order(9)
    @FixFor("debezium/dbz#2536")
    void pausedThenResumedUpdatesStatus() {
        accept(notification("n-paused", SnapshotNotifications.PAUSED, "{}", T0 + 300_000));
        progress().body("status", is("PAUSED"));

        accept(notification("n-resumed", SnapshotNotifications.RESUMED, "{}", T0 + 360_000));
        progress().body("status", is("RUNNING"));
    }

    @Test
    @Order(10)
    @FixFor("debezium/dbz#2536")
    void unknownNotificationTypeIsAcknowledgedButIgnored() {
        accept(notification("n-unknown", "SOMETHING_NEW", "{}", T0 + 420_000));
        // The run keeps going untouched; the unknown type is a no-op.
        progress().body("status", is("RUNNING"));
    }

    @Test
    @Order(11)
    @FixFor("debezium/dbz#2536")
    void nonSnapshotAggregateIsAcknowledgedButIgnored() {
        accept(notification("n-other", "Some Other Aggregate", SnapshotNotifications.STARTED, "{}", T0 + 480_000));
        progress().body("status", is("RUNNING"));
    }

    @Test
    @Order(12)
    @FixFor("debezium/dbz#2536")
    void completedDrainsToIdleAndWritesHistory() {
        accept(notification("n-completed", SnapshotNotifications.COMPLETED, "{}", T0 + 540_000));

        progress()
                .body("status", is("IDLE"))
                .body("tables", hasSize(0));

        given()
                .when().get(historyPath(pipelineId))
                .then()
                .statusCode(200)
                .body("totalElements", is(1))
                .body("items[0].outcome", is("COMPLETED"))
                .body("items[0].type", is("INITIAL"))
                .body("items[0].totalTables", is(2))
                .body("items[0].completedTables", is(1))
                .body("items[0].totalRowsScanned", is(5000));
    }

    @Test
    @Order(13)
    @FixFor("debezium/dbz#2536")
    void startedThenAbortedRecordsAbortedRun() {
        accept(notification("n-started-2", SnapshotNotifications.STARTED,
                additionalData(SnapshotNotifications.K_DATA_COLLECTIONS, "[inventory.orders]"),
                T0 + 600_000));
        progress().body("status", is("RUNNING")).body("globalProgress.totalTables", is(1));

        accept(notification("n-aborted", SnapshotNotifications.ABORTED, "{}", T0 + 660_000));

        progress().body("status", is("IDLE"));
        given()
                .when().get(historyPath(pipelineId))
                .then()
                .statusCode(200)
                .body("totalElements", is(2))
                .body("items[0].outcome", is("ABORTED"));
    }

    @Test
    @Order(14)
    @FixFor("debezium/dbz#2536")
    void startedThenSkippedRecordsSkippedRun() {
        accept(notification("n-started-3", SnapshotNotifications.STARTED,
                additionalData(SnapshotNotifications.K_DATA_COLLECTIONS, "[inventory.orders]"),
                T0 + 720_000));
        progress().body("status", is("RUNNING"));

        accept(notification("n-skipped", SnapshotNotifications.SKIPPED, "{}", T0 + 780_000));

        progress().body("status", is("IDLE"));
        given()
                .when().get(historyPath(pipelineId))
                .then()
                .statusCode(200)
                .body("totalElements", is(3))
                .body("items[0].outcome", is("SKIPPED"));
    }

    @Test
    @Order(99)
    void cleanupTestData() throws Exception {
        tx.begin();
        em.createQuery("DELETE FROM active_snapshot_table t WHERE t.activeSnapshot.pipelineId = :pipelineId")
                .setParameter("pipelineId", pipelineId)
                .executeUpdate();
        em.createQuery("DELETE FROM active_snapshot a WHERE a.pipelineId = :pipelineId")
                .setParameter("pipelineId", pipelineId)
                .executeUpdate();
        em.createQuery("DELETE FROM snapshot_table_history t WHERE t.snapshotHistory.pipelineId = :pipelineId")
                .setParameter("pipelineId", pipelineId)
                .executeUpdate();
        em.createQuery("DELETE FROM snapshot_history h WHERE h.pipelineId = :pipelineId")
                .setParameter("pipelineId", pipelineId)
                .executeUpdate();
        em.createQuery("DELETE FROM pipeline p WHERE p.id = :id")
                .setParameter("id", pipelineId)
                .executeUpdate();
        tx.commit();
    }

    private static void accept(String body) {
        given()
                .contentType(APPLICATION_JSON)
                .body(body)
                .when().post(notificationsPath(pipelineId))
                .then()
                .statusCode(202);
    }

    private static ValidatableResponse progress() {
        return given()
                .when().get(progressPath(pipelineId))
                .then()
                .statusCode(200);
    }

    private static String notification(String id, String type, String additionalData, long timestamp) {
        return notification(id, SnapshotNotifications.AGG_INITIAL, type, additionalData, timestamp);
    }

    private static String notification(String id, String aggregateType, String type, String additionalData, long timestamp) {
        return """
                {
                  "id": "%s",
                  "aggregateType": "%s",
                  "type": "%s",
                  "additionalData": %s,
                  "timestamp": %d
                }
                """.formatted(id, aggregateType, type, additionalData, timestamp);
    }

    private static String additionalData(String... keyValuePairs) {
        StringBuilder json = new StringBuilder("{");
        for (int index = 0; index < keyValuePairs.length; index += 2) {
            if (index > 0) {
                json.append(", ");
            }
            json.append('"').append(keyValuePairs[index]).append("\": \"").append(keyValuePairs[index + 1]).append('"');
        }
        return json.append("}").toString();
    }
}
