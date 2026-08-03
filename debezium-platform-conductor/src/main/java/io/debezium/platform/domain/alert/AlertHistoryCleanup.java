/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import java.time.Instant;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import org.jboss.logging.Logger;

import io.debezium.platform.config.AlertingConfigGroup;
import io.debezium.platform.data.model.AlertEventEntity;
import io.quarkus.scheduler.Scheduled;

@ApplicationScoped
public class AlertHistoryCleanup {

    private static final Logger LOGGER = Logger.getLogger(AlertHistoryCleanup.class);

    private final AlertingConfigGroup.HistoryConfigGroup historyConfig;
    private final EntityManager em;

    public AlertHistoryCleanup(AlertingConfigGroup alertingConfig, EntityManager em) {
        this.historyConfig = alertingConfig.history();
        this.em = em;
    }

    @Scheduled(every = "${alerting.history.cleanup.interval:24h}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    @Transactional
    void cleanup() {
        Instant cutoff = Instant.now().minus(historyConfig.retention());
        int deleted = em.createNamedQuery(AlertEventEntity.DELETE_RESOLVED_OLDER_THAN)
                .setParameter("cutoff", cutoff)
                .executeUpdate();
        if (deleted > 0) {
            LOGGER.infov("Cleaned up {0} resolved alert event(s) older than {1}", deleted, cutoff);
        }
    }
}
