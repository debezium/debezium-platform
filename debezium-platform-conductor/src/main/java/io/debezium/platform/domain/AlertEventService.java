/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static jakarta.transaction.Transactional.TxType.SUPPORTS;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;

import io.debezium.platform.api.dto.AlertEventResponse;
import io.debezium.platform.api.dto.AlertStatusResponse;
import io.debezium.platform.api.dto.AlertStatusResponse.ActiveAlertResponse;
import io.debezium.platform.api.dto.PagedAlertEventResponse;
import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.AlertStateEntity;
import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.Severity;

@ApplicationScoped
@Transactional(SUPPORTS)
public class AlertEventService {

    private final EntityManager em;

    public AlertEventService(EntityManager em) {
        this.em = em;
    }

    public PagedAlertEventResponse listEvents(Severity severity, String status, String pipelineId,
                                              Long ruleId, Instant from, Instant to, int page, int size) {
        size = Math.min(size, 100);

        var where = new ArrayList<String>();
        if (severity != null) {
            where.add("e.severity = :severity");
        }
        if ("firing".equalsIgnoreCase(status)) {
            where.add("e.resolvedAt IS NULL");
        }
        else if ("resolved".equalsIgnoreCase(status)) {
            where.add("e.resolvedAt IS NOT NULL");
        }
        if (pipelineId != null) {
            where.add("e.pipelineId = :pipelineId");
        }
        if (ruleId != null) {
            where.add("e.rule.id = :ruleId");
        }
        if (from != null) {
            where.add("e.createdAt >= :from");
        }
        if (to != null) {
            where.add("e.createdAt <= :to");
        }

        String whereClause = where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where);

        TypedQuery<Long> countQuery = em.createQuery(
                "SELECT COUNT(e) FROM alert_event e" + whereClause, Long.class);
        TypedQuery<AlertEventEntity> dataQuery = em.createQuery(
                "SELECT e FROM alert_event e" + whereClause + " ORDER BY e.createdAt DESC", AlertEventEntity.class);

        bindParameters(countQuery, severity, pipelineId, ruleId, from, to);
        bindParameters(dataQuery, severity, pipelineId, ruleId, from, to);

        long totalElements = countQuery.getSingleResult();
        int totalPages = (int) Math.ceil((double) totalElements / size);

        dataQuery.setFirstResult(page * size);
        dataQuery.setMaxResults(size);

        List<AlertEventResponse> events = dataQuery.getResultList().stream()
                .map(this::toResponse)
                .toList();

        return new PagedAlertEventResponse(events, page, size, totalElements, totalPages);
    }

    public Optional<AlertEventResponse> findById(Long id) {
        AlertEventEntity entity = em.find(AlertEventEntity.class, id);
        return Optional.ofNullable(entity).map(this::toResponse);
    }

    public AlertStatusResponse getStatus() {
        List<AlertStateEntity> activeStates = em.createQuery(
                "SELECT s FROM alert_state s WHERE s.state IN (:states)", AlertStateEntity.class)
                .setParameter("states", List.of(AlertStateValue.FIRING, AlertStateValue.PENDING))
                .getResultList();

        int totalFiring = 0;
        int totalPending = 0;
        Map<Severity, Integer> firingBySeverity = new EnumMap<>(Severity.class);
        List<ActiveAlertResponse> activeAlerts = new ArrayList<>();

        for (AlertStateEntity state : activeStates) {
            if (state.getState() == AlertStateValue.FIRING) {
                totalFiring++;
                Severity sev = state.getRule().getSeverity();
                firingBySeverity.merge(sev, 1, Integer::sum);
            }
            else {
                totalPending++;
            }

            Instant since = state.getState() == AlertStateValue.FIRING
                    ? state.getFiredAt()
                    : state.getPendingSince();

            activeAlerts.add(new ActiveAlertResponse(
                    state.getRule().getId(),
                    state.getRule().getName(),
                    state.getPipelineId(),
                    state.getState(),
                    state.getRule().getSeverity(),
                    state.getValue() != null ? state.getValue() : 0.0,
                    state.getRule().getThreshold(),
                    since));
        }

        return new AlertStatusResponse(totalFiring, totalPending, firingBySeverity, activeAlerts);
    }

    private AlertEventResponse toResponse(AlertEventEntity entity) {
        Instant firedAt = entity.getFiredAt();
        Instant resolvedAt = entity.getResolvedAt();
        String eventStatus = resolvedAt == null ? "firing" : "resolved";
        Long durationSeconds = resolvedAt != null
                ? Duration.between(firedAt, resolvedAt).toSeconds()
                : Duration.between(firedAt, Instant.now()).toSeconds();

        return new AlertEventResponse(
                entity.getId(),
                entity.getRule() != null ? entity.getRule().getId() : null,
                entity.getRuleName(),
                entity.getPipelineId(),
                entity.getPipelineName(),
                eventStatus,
                entity.getValue(),
                entity.getThreshold(),
                entity.getSeverity(),
                entity.getMessage(),
                firedAt,
                resolvedAt,
                durationSeconds,
                entity.getCreatedAt());
    }

    private void bindParameters(TypedQuery<?> query, Severity severity, String pipelineId,
                                Long ruleId, Instant from, Instant to) {
        if (severity != null) {
            query.setParameter("severity", severity);
        }
        if (pipelineId != null) {
            query.setParameter("pipelineId", pipelineId);
        }
        if (ruleId != null) {
            query.setParameter("ruleId", ruleId);
        }
        if (from != null) {
            query.setParameter("from", from);
        }
        if (to != null) {
            query.setParameter("to", to);
        }
    }
}
