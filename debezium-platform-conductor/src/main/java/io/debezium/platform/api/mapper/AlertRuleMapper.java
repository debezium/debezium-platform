/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.api.mapper;

import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.inject.Inject;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

import io.debezium.platform.api.dto.AlertRuleRequest;
import io.debezium.platform.api.dto.AlertRuleResponse;
import io.debezium.platform.api.dto.AlertRuleResponse.ChannelSummary;
import io.debezium.platform.domain.PanelConfigLoader;
import io.debezium.platform.domain.views.AlertRule;
import io.debezium.platform.domain.views.refs.NotificationChannelSummary;

@Mapper(componentModel = "cdi")
public abstract class AlertRuleMapper extends BaseMapper {

    @Inject
    PanelConfigLoader panelConfigLoader;

    public AlertRuleResponse toResponse(AlertRule view) {
        String panelTitle = panelConfigLoader.loadPanels().stream()
                .filter(p -> p.id().equals(view.getPanelId()))
                .findFirst()
                .map(p -> p.title())
                .orElse(null);

        List<ChannelSummary> channels = view.getChannels() != null
                ? view.getChannels().stream()
                        .map(ch -> new ChannelSummary(ch.getId(), ch.getName(), ch.getType()))
                        .toList()
                : Collections.emptyList();

        return new AlertRuleResponse(
                view.getId(),
                view.getName(),
                view.getDescription(),
                view.getPanelId(),
                panelTitle,
                view.getOperator(),
                view.getThreshold(),
                parseDuration(view.getForDuration()),
                view.getReduceFunction(),
                parseDuration(view.getEvaluationWindow()),
                view.getSeverity(),
                view.isEnabled(),
                channels,
                view.getCreatedAt(),
                view.getUpdatedAt());
    }

    public List<AlertRuleResponse> toResponseList(List<AlertRule> views) {
        return views.stream().map(this::toResponse).toList();
    }

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "channels", ignore = true)
    @Mapping(target = "forDuration", ignore = true)
    @Mapping(target = "evaluationWindow", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    abstract void applyBasicFields(AlertRuleRequest request, @MappingTarget AlertRule view);

    public void applyToView(AlertRuleRequest request, AlertRule view) {
        applyBasicFields(request, view);

        if (request.forDuration() != null) {
            view.setForDuration(request.forDuration().toString());
        }
        if (request.evaluationWindow() != null) {
            view.setEvaluationWindow(request.evaluationWindow().toString());
        }

        if (request.channelIds() != null) {
            Set<NotificationChannelSummary> channels = request.channelIds().stream()
                    .map(id -> evm.getReference(NotificationChannelSummary.class, id))
                    .collect(Collectors.toSet());
            view.setChannels(channels);
        }
    }

    private Duration parseDuration(String value) {
        return value != null ? Duration.parse(value) : null;
    }
}
