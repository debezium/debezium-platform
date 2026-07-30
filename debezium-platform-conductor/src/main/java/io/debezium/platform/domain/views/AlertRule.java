/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.time.Instant;
import java.util.Set;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.blazebit.persistence.view.CreatableEntityView;
import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.UpdatableEntityView;

import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.ReduceFunction;
import io.debezium.platform.data.model.Severity;
import io.debezium.platform.domain.views.base.NamedView;
import io.debezium.platform.domain.views.refs.NotificationChannelSummary;
import io.debezium.platform.validation.ValidationPatterns;

@EntityView(AlertRuleEntity.class)
@CreatableEntityView(excludedEntityAttributes = { "createdAt", "updatedAt" })
@UpdatableEntityView
public interface AlertRule extends NamedView {

    @Override
    @NotEmpty
    @Size(max = 253, message = "Alert rule name must be 253 characters or fewer")
    @Pattern(regexp = ValidationPatterns.RFC_1123_SUBDOMAIN, message = "Alert rule name must be a lowercase RFC 1123 subdomain")
    String getName();

    String getDescription();

    @NotEmpty
    String getPanelId();

    @NotNull
    Operator getOperator();

    double getThreshold();

    String getForDuration();

    ReduceFunction getReduceFunction();

    String getEvaluationWindow();

    Severity getSeverity();

    boolean isEnabled();

    Set<NotificationChannelSummary> getChannels();

    Instant getCreatedAt();

    Instant getUpdatedAt();

    void setName(String name);

    void setDescription(String description);

    void setPanelId(String panelId);

    void setOperator(Operator operator);

    void setThreshold(double threshold);

    void setForDuration(String forDuration);

    void setReduceFunction(ReduceFunction reduceFunction);

    void setEvaluationWindow(String evaluationWindow);

    void setSeverity(Severity severity);

    void setEnabled(boolean enabled);

    void setChannels(Set<NotificationChannelSummary> channels);
}
