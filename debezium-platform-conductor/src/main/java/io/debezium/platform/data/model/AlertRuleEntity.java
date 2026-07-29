/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import io.debezium.platform.validation.ValidationPatterns;

@Entity(name = "alert_rule")
public class AlertRuleEntity {

    @Id
    @GeneratedValue
    private Long id;

    @NotEmpty
    @Size(max = 253, message = "Alert rule name must be 253 characters or fewer")
    @Pattern(regexp = ValidationPatterns.RFC_1123_SUBDOMAIN, message = "Alert rule name must be a lowercase RFC 1123 subdomain")
    @Column(unique = true, nullable = false, length = 253)
    private String name;

    private String description;

    @Column(name = "panel_id", nullable = false)
    private String panelId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Operator operator;

    @Column(nullable = false)
    private double threshold;

    @Column(name = "for_duration", nullable = false, length = 30)
    private String forDuration = "PT0S";

    @Enumerated(EnumType.STRING)
    @Column(name = "reduce_function", nullable = false, length = 10)
    private ReduceFunction reduceFunction = ReduceFunction.LAST;

    @Column(name = "evaluation_window", nullable = false, length = 30)
    private String evaluationWindow = "PT5M";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Severity severity = Severity.WARNING;

    @Column(nullable = false)
    private boolean enabled = true;

    @ManyToMany
    @JoinTable(name = "alert_rule_channel", joinColumns = @JoinColumn(name = "rule_id"), inverseJoinColumns = @JoinColumn(name = "channel_id"))
    private Set<NotificationChannelEntity> channels = new HashSet<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    public void prePersist() {
        var now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getPanelId() {
        return panelId;
    }

    public void setPanelId(String panelId) {
        this.panelId = panelId;
    }

    public Operator getOperator() {
        return operator;
    }

    public void setOperator(Operator operator) {
        this.operator = operator;
    }

    public double getThreshold() {
        return threshold;
    }

    public void setThreshold(double threshold) {
        this.threshold = threshold;
    }

    public String getForDuration() {
        return forDuration;
    }

    public void setForDuration(String forDuration) {
        this.forDuration = forDuration;
    }

    public ReduceFunction getReduceFunction() {
        return reduceFunction;
    }

    public void setReduceFunction(ReduceFunction reduceFunction) {
        this.reduceFunction = reduceFunction;
    }

    public String getEvaluationWindow() {
        return evaluationWindow;
    }

    public void setEvaluationWindow(String evaluationWindow) {
        this.evaluationWindow = evaluationWindow;
    }

    public Severity getSeverity() {
        return severity;
    }

    public void setSeverity(Severity severity) {
        this.severity = severity;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Set<NotificationChannelEntity> getChannels() {
        return channels;
    }

    public void setChannels(Set<NotificationChannelEntity> channels) {
        this.channels = channels;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
