/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.snapshot;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.UserTransaction;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import io.debezium.connector.SnapshotType;
import io.debezium.doc.FixFor;
import io.debezium.platform.data.model.SnapshotHistoryEntity;
import io.debezium.platform.data.model.SnapshotState;
import io.debezium.platform.data.model.SnapshotTableHistoryEntity;
import io.debezium.platform.data.model.TableState;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

/**
 * Exercises the retention cleanup job against the real Flyway schema (DDD-68): rows completed before
 * the retention cutoff are removed, recent rows are kept, and the child table rows cascade away with
 * their parent. The {@link SnapshotHistoryCleanupTestProfile} shrinks the retention window to 1s so a
 * row aged a minute is already expired.
 */
@QuarkusTest
@TestProfile(SnapshotHistoryCleanupTestProfile.class)
class SnapshotHistoryCleanupIT {

    private static final Long PIPELINE_ID = 4242L;

    @Inject
    EntityManager em;

    @Inject
    UserTransaction tx;

    @Inject
    SnapshotHistoryCleanup cleanup;

    @AfterEach
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

    @Test
    @FixFor("debezium/dbz#2536")
    void cleanupDeletesRunsOlderThanRetention() throws Exception {
        Long expiredId = persistRun(Instant.now().minusSeconds(60), false);

        cleanup.cleanup();

        assertThat(find(expiredId)).isNull();
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void cleanupPreservesRecentRuns() throws Exception {
        Long recentId = persistRun(Instant.now(), false);

        cleanup.cleanup();

        assertThat(find(recentId)).isNotNull();
    }

    @Test
    @FixFor("debezium/dbz#2536")
    void cleanupCascadesToTableChildren() throws Exception {
        Long expiredId = persistRun(Instant.now().minusSeconds(60), true);

        cleanup.cleanup();

        assertThat(find(expiredId)).isNull();
        Long remainingChildren = em.createQuery(
                "SELECT count(t) FROM snapshot_table_history t WHERE t.snapshotHistory.id = :id", Long.class)
                .setParameter("id", expiredId)
                .getSingleResult();
        assertThat(remainingChildren).isZero();
    }

    private Long persistRun(Instant completedAt, boolean withTable) throws Exception {
        tx.begin();
        SnapshotHistoryEntity history = new SnapshotHistoryEntity();
        history.setPipelineId(PIPELINE_ID);
        history.setPipelineName("Retention Pipeline");
        history.setType(SnapshotType.INITIAL);
        history.setOutcome(SnapshotState.COMPLETED);
        history.setTotalTables(withTable ? 1 : 0);
        history.setCompletedTables(withTable ? 1 : 0);
        history.setTotalRowsScanned(withTable ? 100L : 0L);
        history.setStartedAt(completedAt.minusSeconds(30));
        history.setCompletedAt(completedAt);
        history.setDurationSeconds(30L);
        if (withTable) {
            SnapshotTableHistoryEntity table = new SnapshotTableHistoryEntity();
            table.setTableName("inventory.orders");
            table.setOutcome(TableState.COMPLETED);
            table.setOrderIndex(0);
            table.setRowsScanned(100L);
            table.setDurationSeconds(30L);
            history.addTable(table);
        }
        em.persist(history);
        em.flush();
        Long id = history.getId();
        tx.commit();
        return id;
    }

    private SnapshotHistoryEntity find(Long id) throws Exception {
        tx.begin();
        SnapshotHistoryEntity found = em.find(SnapshotHistoryEntity.class, id);
        tx.commit();
        return found;
    }
}
