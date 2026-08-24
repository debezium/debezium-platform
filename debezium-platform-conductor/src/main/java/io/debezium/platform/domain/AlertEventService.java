/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static jakarta.transaction.Transactional.TxType.SUPPORTS;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import com.blazebit.persistence.CriteriaBuilder;
import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.PagedList;
import com.blazebit.persistence.view.EntityViewManager;
import com.blazebit.persistence.view.EntityViewSetting;

import io.debezium.platform.api.dto.AlertEventResponse;
import io.debezium.platform.api.dto.PagedAlertEventResponse;
import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.Severity;
import io.debezium.platform.domain.views.AlertEvent;
import io.debezium.platform.domain.views.refs.AlertEventReference;

@ApplicationScoped
public class AlertEventService extends AbstractService<AlertEventEntity, AlertEvent, AlertEventReference> {

    public AlertEventService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm) {
        super(AlertEventEntity.class, AlertEvent.class, AlertEventReference.class, em, cbf, evm);
    }

    @Transactional(SUPPORTS)
    public PagedAlertEventResponse listEvents(Severity severity, String status, String pipelineId,
                                              Long ruleId, Instant from, Instant to, int page, int size) {

        CriteriaBuilder<AlertEventEntity> criteria = cb();

        if (severity != null) {
            criteria.where("severity").eq(severity);
        }
        if ("firing".equalsIgnoreCase(status)) {
            criteria.where("resolvedAt").isNull();
        }
        else if ("resolved".equalsIgnoreCase(status)) {
            criteria.where("resolvedAt").isNotNull();
        }
        if (pipelineId != null) {
            criteria.where("pipelineId").eq(pipelineId);
        }
        if (ruleId != null) {
            criteria.where("rule.id").eq(ruleId);
        }
        if (from != null) {
            criteria.where("createdAt").ge(from);
        }
        if (to != null) {
            criteria.where("createdAt").le(to);
        }

        criteria.orderByDesc("createdAt");
        criteria.orderByDesc("id");

        PagedList<AlertEvent> result = evm.applySetting(
                EntityViewSetting.create(AlertEvent.class, page * size, size), criteria)
                .getResultList();

        List<AlertEventResponse> events = result.stream()
                .map(this::toResponse)
                .toList();

        return new PagedAlertEventResponse(events, page, size, result.getTotalSize(), result.getTotalPages());
    }

    @Transactional(SUPPORTS)
    public Optional<AlertEventResponse> findEventById(Long id) {
        return findById(id).map(this::toResponse);
    }

    @Transactional
    public AlertEventEntity createFiringEvent(AlertRuleEntity rule, String pipelineId,
                                              Double value, String message, Instant firedAt) {
        AlertEventEntity event = new AlertEventEntity();
        event.setRule(rule);
        event.setRuleName(rule.getName());
        event.setPipelineId(pipelineId);
        event.setValue(value);
        event.setThreshold(rule.getThreshold());
        event.setSeverity(rule.getSeverity());
        event.setFiredAt(firedAt);
        event.setMessage(message);
        em.persist(event);
        return event;
    }

    @Transactional
    public void resolveEvent(AlertEventEntity event, Instant resolvedAt) {
        event.setResolvedAt(resolvedAt);
        em.merge(event);
    }

    @Transactional
    public int deleteResolvedOlderThan(Instant cutoff) {
        return em.createNamedQuery(AlertEventEntity.DELETE_RESOLVED_OLDER_THAN)
                .setParameter("cutoff", cutoff)
                .executeUpdate();
    }

    private AlertEventResponse toResponse(AlertEvent view) {
        Instant firedAt = view.getFiredAt();
        Instant resolvedAt = view.getResolvedAt();
        String eventStatus = resolvedAt == null ? "firing" : "resolved";
        Long durationSeconds = resolvedAt != null
                ? Duration.between(firedAt, resolvedAt).toSeconds()
                : Duration.between(firedAt, Instant.now()).toSeconds();

        return new AlertEventResponse(
                view.getId(),
                view.getRuleId(),
                view.getRuleName(),
                view.getPipelineId(),
                view.getPipelineName(),
                eventStatus,
                view.getValue(),
                view.getThreshold(),
                view.getSeverity(),
                view.getMessage(),
                firedAt,
                resolvedAt,
                durationSeconds,
                view.getCreatedAt());
    }
}
