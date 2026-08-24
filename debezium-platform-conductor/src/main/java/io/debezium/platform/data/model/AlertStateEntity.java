/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.NamedQuery;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity(name = "alert_state")
@Table(uniqueConstraints = @UniqueConstraint(columnNames = { "rule_id", "pipeline_id" }))
@NamedQuery(name = AlertStateEntity.FIND_BY_RULE_ID, query = "SELECT s FROM alert_state s WHERE s.rule.id = :ruleId")
@NamedQuery(name = AlertStateEntity.FIND_ACTIVE, query = "SELECT s FROM alert_state s WHERE s.state IN (:states)")
public class AlertStateEntity {

    public static final String FIND_BY_RULE_ID = "AlertState.findByRuleId";
    public static final String FIND_ACTIVE = "AlertState.findActive";

    @Id
    @GeneratedValue
    private Long id;

    @ManyToOne
    @JoinColumn(name = "rule_id", nullable = false)
    private AlertRuleEntity rule;

    @Column(name = "pipeline_id", nullable = false)
    private String pipelineId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AlertStateValue state = AlertStateValue.OK;

    private Double value;

    @Column(name = "pending_since")
    private Instant pendingSince;

    @Column(name = "fired_at")
    private Instant firedAt;

    @ManyToOne
    @JoinColumn(name = "active_event_id")
    private AlertEventEntity activeEvent;

    @Column(name = "last_evaluated_at")
    private Instant lastEvaluatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public AlertRuleEntity getRule() {
        return rule;
    }

    public void setRule(AlertRuleEntity rule) {
        this.rule = rule;
    }

    public String getPipelineId() {
        return pipelineId;
    }

    public void setPipelineId(String pipelineId) {
        this.pipelineId = pipelineId;
    }

    public AlertStateValue getState() {
        return state;
    }

    public void setState(AlertStateValue state) {
        this.state = state;
    }

    public Double getValue() {
        return value;
    }

    public void setValue(Double value) {
        this.value = value;
    }

    public Instant getPendingSince() {
        return pendingSince;
    }

    public void setPendingSince(Instant pendingSince) {
        this.pendingSince = pendingSince;
    }

    public Instant getFiredAt() {
        return firedAt;
    }

    public void setFiredAt(Instant firedAt) {
        this.firedAt = firedAt;
    }

    public AlertEventEntity getActiveEvent() {
        return activeEvent;
    }

    public void setActiveEvent(AlertEventEntity activeEvent) {
        this.activeEvent = activeEvent;
    }

    public Instant getLastEvaluatedAt() {
        return lastEvaluatedAt;
    }

    public void setLastEvaluatedAt(Instant lastEvaluatedAt) {
        this.lastEvaluatedAt = lastEvaluatedAt;
    }
}
