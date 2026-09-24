/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;

import java.time.Instant;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;

import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import io.debezium.connector.SnapshotType;
import io.debezium.doc.FixFor;
import io.debezium.platform.data.model.SnapshotHistoryEntity;
import io.debezium.platform.data.model.SnapshotState;
import io.debezium.platform.data.model.SnapshotTableHistoryEntity;
import io.debezium.platform.data.model.TableState;
import io.quarkus.test.junit.QuarkusTest;

/**
 * REST integration tests for {@link SnapshotHistoryResource} (DDD-68): the paginated/filterable list
 * and the single-run detail endpoint with the per-table breakdown, against the real Flyway schema and
 * Blazebit views.
 */
@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class SnapshotHistoryResourceIT {

    private static final Long PIPELINE_ID = 5001L;
    private static final Long OTHER_PIPELINE_ID = 5002L;
    private static final String HISTORY_PATH = "api/pipelines/" + PIPELINE_ID + "/snapshots/history";

    static Long completedInitialId;
    static Long abortedIncrementalId;
    static Long completedInitialLatestId;

    @Inject
    EntityManager em;

    @Inject
    UserTransaction tx;

    @Test
    @Order(0)
    void seedTestData() throws Exception {
        tx.begin();
        try {
            SnapshotHistoryEntity completedInitial = run(SnapshotType.INITIAL, SnapshotState.COMPLETED,
                    Instant.parse("2026-09-01T10:00:00Z"), 2, 2, 300L);
            SnapshotTableHistoryEntity ordersTable = tableEntry("inventory.orders", TableState.COMPLETED, 0, 250L, null, 30L);
            SnapshotTableHistoryEntity auditTable = tableEntry("inventory.audit", TableState.SKIPPED, 1, 0L, "Table is empty", 0L);
            completedInitial.addTable(ordersTable);
            completedInitial.addTable(auditTable);
            em.persist(completedInitial);

            SnapshotHistoryEntity abortedIncremental = run(SnapshotType.INCREMENTAL, SnapshotState.ABORTED,
                    Instant.parse("2026-09-02T10:00:00Z"), 1, 0, 10L);
            em.persist(abortedIncremental);

            SnapshotHistoryEntity completedInitialLatest = run(SnapshotType.INITIAL, SnapshotState.COMPLETED,
                    Instant.parse("2026-09-03T10:00:00Z"), 3, 3, 900L);
            em.persist(completedInitialLatest);

            em.flush();
            completedInitialId = completedInitial.getId();
            abortedIncrementalId = abortedIncremental.getId();
            completedInitialLatestId = completedInitialLatest.getId();
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
    void listReturnsRunsNewestFirst() {
        given()
                .when().get(HISTORY_PATH)
                .then()
                .statusCode(200)
                .body("page", is(0))
                .body("size", is(20))
                .body("totalElements", is(3))
                .body("totalPages", is(1))
                .body("items", hasSize(3))
                .body("items.id", contains(
                        completedInitialLatestId.intValue(),
                        abortedIncrementalId.intValue(),
                        completedInitialId.intValue()))
                // the list view omits the per-table breakdown to keep the payload light
                .body("items[0].tables", is(nullValue()));
    }

    @Test
    @Order(2)
    @FixFor("debezium/dbz#2536")
    void listFilterByType() {
        given()
                .queryParam("type", "INITIAL")
                .when().get(HISTORY_PATH)
                .then()
                .statusCode(200)
                .body("totalElements", is(2))
                .body("items", hasSize(2));
    }

    @Test
    @Order(3)
    @FixFor("debezium/dbz#2536")
    void listFilterByOutcome() {
        given()
                .queryParam("outcome", "ABORTED")
                .when().get(HISTORY_PATH)
                .then()
                .statusCode(200)
                .body("totalElements", is(1))
                .body("items", hasSize(1))
                .body("items[0].outcome", is("ABORTED"))
                .body("items[0].type", is("INCREMENTAL"));
    }

    @Test
    @Order(4)
    @FixFor("debezium/dbz#2536")
    void listFilterByCompletedAtWindow() {
        given()
                .queryParam("from", "2026-09-02T00:00:00Z")
                .queryParam("to", "2026-09-02T23:59:59Z")
                .when().get(HISTORY_PATH)
                .then()
                .statusCode(200)
                .body("totalElements", is(1))
                .body("items[0].id", is(abortedIncrementalId.intValue()));
    }

    @Test
    @Order(5)
    @FixFor("debezium/dbz#2536")
    void listWithPagination() {
        given()
                .queryParam("page", 0)
                .queryParam("size", 2)
                .when().get(HISTORY_PATH)
                .then()
                .statusCode(200)
                .body("page", is(0))
                .body("size", is(2))
                .body("totalElements", is(3))
                .body("totalPages", is(2))
                .body("items", hasSize(2));
    }

    @Test
    @Order(6)
    @FixFor("debezium/dbz#2536")
    void getByIdReturnsPerTableBreakdown() {
        given()
                .when().get(HISTORY_PATH + "/" + completedInitialId)
                .then()
                .statusCode(200)
                .body("id", equalTo(completedInitialId.intValue()))
                .body("pipelineId", equalTo(PIPELINE_ID.intValue()))
                .body("type", is("INITIAL"))
                .body("outcome", is("COMPLETED"))
                .body("totalTables", is(2))
                .body("completedTables", is(2))
                .body("totalRowsScanned", is(300))
                .body("tables", hasSize(2))
                .body("tables[0].tableName", is("inventory.orders"))
                .body("tables[0].outcome", is("COMPLETED"))
                .body("tables[0].rowsScanned", is(250))
                .body("tables[1].tableName", is("inventory.audit"))
                .body("tables[1].outcome", is("SKIPPED"))
                .body("tables[1].skipReason", is("Table is empty"));
    }

    @Test
    @Order(7)
    @FixFor("debezium/dbz#2536")
    void getByIdUnknownReturnsNotFound() {
        given()
                .when().get(HISTORY_PATH + "/999999")
                .then()
                .statusCode(404);
    }

    @Test
    @Order(8)
    @FixFor("debezium/dbz#2536")
    void getByIdForWrongPipelineReturnsNotFound() {
        given()
                .when().get("api/pipelines/" + OTHER_PIPELINE_ID + "/snapshots/history/" + completedInitialId)
                .then()
                .statusCode(404);
    }

    @Test
    @Order(9)
    @FixFor("debezium/dbz#2536")
    void invalidPagingReturnsBadRequest() {
        given()
                .queryParam("page", -1)
                .queryParam("size", 0)
                .when().get(HISTORY_PATH)
                .then()
                .statusCode(400);
    }

    @Test
    @Order(99)
    void cleanupTestData() throws Exception {
        tx.begin();
        em.createQuery("DELETE FROM snapshot_table_history t WHERE t.snapshotHistory.pipelineId = :pipelineId")
                .setParameter("pipelineId", PIPELINE_ID)
                .executeUpdate();
        em.createQuery("DELETE FROM snapshot_history h WHERE h.pipelineId = :pipelineId")
                .setParameter("pipelineId", PIPELINE_ID)
                .executeUpdate();
        tx.commit();
    }

    private static SnapshotHistoryEntity run(SnapshotType type, SnapshotState outcome, Instant completedAt,
                                             int totalTables, int completedTables, long totalRowsScanned) {
        SnapshotHistoryEntity history = new SnapshotHistoryEntity();
        history.setPipelineId(PIPELINE_ID);
        history.setPipelineName("History Pipeline");
        history.setType(type);
        history.setOutcome(outcome);
        history.setTotalTables(totalTables);
        history.setCompletedTables(completedTables);
        history.setTotalRowsScanned(totalRowsScanned);
        history.setStartedAt(completedAt.minusSeconds(300));
        history.setCompletedAt(completedAt);
        history.setDurationSeconds(300L);
        return history;
    }

    private static SnapshotTableHistoryEntity tableEntry(String tableName, TableState outcome, int orderIndex,
                                                         long rowsScanned, String skipReason, Long durationSeconds) {
        SnapshotTableHistoryEntity entry = new SnapshotTableHistoryEntity();
        entry.setTableName(tableName);
        entry.setOutcome(outcome);
        entry.setOrderIndex(orderIndex);
        entry.setRowsScanned(rowsScanned);
        entry.setSkipReason(skipReason);
        entry.setDurationSeconds(durationSeconds);
        return entry;
    }
}
