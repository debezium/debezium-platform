/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.config.PanelConfig;
import io.debezium.platform.data.dto.PrometheusInstantQueryResponse;
import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.AlertStateEntity;
import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.ReduceFunction;
import io.debezium.platform.domain.AlertRuleService;
import io.debezium.platform.domain.PanelConfigLoader;
import io.debezium.platform.environment.actions.client.PrometheusClient;
import io.quarkus.scheduler.Scheduled;

@ApplicationScoped
public class AlertEvaluationEngine {

    private static final Logger LOGGER = LoggerFactory.getLogger(AlertEvaluationEngine.class);

    private final AlertRuleService ruleService;
    private final PanelConfigLoader panelConfigLoader;
    private final PrometheusClient prometheusClient;
    private final AlertStateManager stateManager;

    public AlertEvaluationEngine(AlertRuleService ruleService,
                                 PanelConfigLoader panelConfigLoader,
                                 @RestClient PrometheusClient prometheusClient,
                                 AlertStateManager stateManager) {
        this.ruleService = ruleService;
        this.panelConfigLoader = panelConfigLoader;
        this.prometheusClient = prometheusClient;
        this.stateManager = stateManager;
    }

    @Scheduled(every = "${alerting.evaluation.interval:60s}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    @Transactional
    void evaluateAll() {
        List<AlertRuleEntity> rules = ruleService.findAllEnabled();

        if (rules.isEmpty()) {
            return;
        }

        LOGGER.debug("Starting evaluation cycle for {} enabled rule(s)", rules.size());
        Instant now = Instant.now();

        for (AlertRuleEntity rule : rules) {
            try {
                evaluateRule(rule, now);
            }
            catch (Exception e) {
                LOGGER.error("Failed to evaluate rule '{}'", rule.getName(), e);
            }
        }
    }

    private void evaluateRule(AlertRuleEntity rule, Instant now) {
        PanelConfig panel = panelConfigLoader.loadPanels().stream()
                .filter(p -> p.id().equals(rule.getPanelId()))
                .findFirst()
                .orElse(null);

        if (panel == null) {
            LOGGER.warn("Panel '{}' not found for rule '{}', skipping", rule.getPanelId(), rule.getName());
            return;
        }

        String query = buildAlertQuery(panel.query(), rule.getReduceFunction(), rule.getEvaluationWindow());
        PrometheusInstantQueryResponse response = prometheusClient.query(query, now.toString());
        Map<String, Double> pipelineValues = extractByPipeline(response);

        List<AlertStateEntity> existingStates = stateManager.findByRuleId(rule.getId());

        Map<String, AlertStateEntity> stateByPipeline = existingStates.stream()
                .collect(Collectors.toMap(AlertStateEntity::getPipelineId, Function.identity()));

        for (var entry : pipelineValues.entrySet()) {
            AlertStateEntity state = stateByPipeline.remove(entry.getKey());
            stateManager.evaluate(rule, entry.getKey(), entry.getValue(), state, now);
        }

        for (AlertStateEntity orphanedState : stateByPipeline.values()) {
            if (orphanedState.getState() == AlertStateValue.PENDING
                    || orphanedState.getState() == AlertStateValue.FIRING) {
                stateManager.resolve(rule, orphanedState, now);
            }
        }
    }

    String buildAlertQuery(String panelQuery, ReduceFunction reduce, String evaluationWindow) {
        String global = removeServiceNameFilter(panelQuery);
        String reduced = reduce.wrapQuery(global, evaluationWindow);
        return aggregateByPipeline(reduced);
    }

    String removeServiceNameFilter(String panelQuery) {
        return panelQuery
                .replace("service_name=\"{{pipeline_id}}\",", "")
                .replace(",service_name=\"{{pipeline_id}}\"", "")
                .replace("service_name=\"{{pipeline_id}}\"", "");
    }

    private String aggregateByPipeline(String query) {
        return "sum by (service_name) (" + query + ")";
    }

    Map<String, Double> extractByPipeline(PrometheusInstantQueryResponse response) {
        if (response == null || response.data() == null || response.data().result() == null) {
            return Map.of();
        }

        Map<String, Double> results = new HashMap<>();
        for (var result : response.data().result()) {
            String pipelineId = result.metric().get("service_name");
            if (pipelineId == null || result.value() == null || result.value().size() < 2) {
                continue;
            }
            try {
                double value = Double.parseDouble(result.value().get(1).toString());
                results.put(pipelineId, value);
            }
            catch (NumberFormatException e) {
                LOGGER.warn("Skipping non-numeric value for pipeline '{}': {}", pipelineId, result.value());
            }
        }
        return results;
    }
}
