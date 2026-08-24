/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.debezium.platform.config.PanelConfig;
import io.debezium.platform.data.dto.PrometheusInstantQueryResponse;
import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.ReduceFunction;
import io.debezium.platform.data.model.Severity;
import io.debezium.platform.domain.AlertRuleService;
import io.debezium.platform.domain.AlertStateService;
import io.debezium.platform.domain.PanelConfigLoader;
import io.debezium.platform.environment.actions.client.PrometheusClient;

@ExtendWith(MockitoExtension.class)
class AlertEvaluationEngineTest {

    private static final String PANEL_QUERY = "rate(debezium_event_count_total{service_name=\"{{pipeline_id}}\"}[5m])";

    @Mock
    AlertRuleService ruleService;

    @Mock
    PanelConfigLoader panelConfigLoader;

    @Mock
    PrometheusClient prometheusClient;

    @Mock
    AlertStateService stateManager;

    AlertEvaluationEngine engine;

    @BeforeEach
    void setUp() {
        engine = new AlertEvaluationEngine(ruleService, panelConfigLoader, prometheusClient, stateManager);
    }

    @Test
    void removeServiceNameFilterMiddlePosition() {
        String query = "rate(debezium_event_count_total{service_name=\"{{pipeline_id}}\",job=\"test\"}[5m])";
        assertThat(engine.removeServiceNameFilter(query))
                .isEqualTo("rate(debezium_event_count_total{job=\"test\"}[5m])");
    }

    @Test
    void removeServiceNameFilterEndPosition() {
        String query = "rate(debezium_event_count_total{job=\"test\",service_name=\"{{pipeline_id}}\"}[5m])";
        assertThat(engine.removeServiceNameFilter(query))
                .isEqualTo("rate(debezium_event_count_total{job=\"test\"}[5m])");
    }

    @Test
    void removeServiceNameFilterOnlyFilter() {
        String query = "rate(debezium_event_count_total{service_name=\"{{pipeline_id}}\"}[5m])";
        assertThat(engine.removeServiceNameFilter(query))
                .isEqualTo("rate(debezium_event_count_total{}[5m])");
    }

    @Test
    void buildAlertQueryWithLastReduceFunction() {
        String result = engine.buildAlertQuery(PANEL_QUERY, ReduceFunction.LAST, "PT5M");
        assertThat(result).isEqualTo("sum by (service_name) (rate(debezium_event_count_total{}[5m]))");
    }

    @Test
    void buildAlertQueryWithAvgReduceFunction() {
        String result = engine.buildAlertQuery(PANEL_QUERY, ReduceFunction.AVG, "PT10M");
        assertThat(result).isEqualTo("sum by (service_name) (avg_over_time((rate(debezium_event_count_total{}[5m]))[10m:]))");
    }

    @Test
    void toPrometheusDurationConvertsMinutes() {
        assertThat(AlertEvaluationEngine.toPrometheusDuration("PT5M")).isEqualTo("5m");
    }

    @Test
    void toPrometheusDurationConvertsHours() {
        assertThat(AlertEvaluationEngine.toPrometheusDuration("PT1H")).isEqualTo("1h");
    }

    @Test
    void toPrometheusDurationConvertsCompoundDuration() {
        assertThat(AlertEvaluationEngine.toPrometheusDuration("PT1H30M15S")).isEqualTo("1h30m15s");
    }

    @Test
    void toPrometheusDurationConvertsSeconds() {
        assertThat(AlertEvaluationEngine.toPrometheusDuration("PT30S")).isEqualTo("30s");
    }

    @Test
    void toPrometheusDurationHandlesNull() {
        assertThat(AlertEvaluationEngine.toPrometheusDuration(null)).isNull();
    }

    @Test
    void extractByPipelineValidResponse() {
        var response = new PrometheusInstantQueryResponse("success",
                new PrometheusInstantQueryResponse.Data("vector", List.of(
                        new PrometheusInstantQueryResponse.Result(
                                Map.of("service_name", "pipeline-1"),
                                List.of(1234567890.0, "42.5")),
                        new PrometheusInstantQueryResponse.Result(
                                Map.of("service_name", "pipeline-2"),
                                List.of(1234567890.0, "13.7")))));

        Map<String, Double> result = engine.extractByPipeline(response);

        assertThat(result).hasSize(2)
                .containsEntry("pipeline-1", 42.5)
                .containsEntry("pipeline-2", 13.7);
    }

    @Test
    void extractByPipelineNullResponse() {
        assertThat(engine.extractByPipeline(null)).isEmpty();
    }

    @Test
    void extractByPipelineNullData() {
        var response = new PrometheusInstantQueryResponse("success", null);
        assertThat(engine.extractByPipeline(response)).isEmpty();
    }

    @Test
    void extractByPipelineSkipsMissingServiceName() {
        var response = new PrometheusInstantQueryResponse("success",
                new PrometheusInstantQueryResponse.Data("vector", List.of(
                        new PrometheusInstantQueryResponse.Result(
                                Map.of("other_label", "value"),
                                List.of(1234567890.0, "42.5")))));

        assertThat(engine.extractByPipeline(response)).isEmpty();
    }

    @Test
    void extractByPipelineSkipsNonNumericValue() {
        var response = new PrometheusInstantQueryResponse("success",
                new PrometheusInstantQueryResponse.Data("vector", List.of(
                        new PrometheusInstantQueryResponse.Result(
                                Map.of("service_name", "pipeline-1"),
                                List.of(1234567890.0, "NaN")))));

        assertThat(engine.extractByPipeline(response)).containsEntry("pipeline-1", Double.NaN);
    }

    @Test
    void extractByPipelineSkipsTooShortValueList() {
        var response = new PrometheusInstantQueryResponse("success",
                new PrometheusInstantQueryResponse.Data("vector", List.of(
                        new PrometheusInstantQueryResponse.Result(
                                Map.of("service_name", "pipeline-1"),
                                List.of(1234567890.0)))));

        assertThat(engine.extractByPipeline(response)).isEmpty();
    }

    @Test
    void evaluateAllSkipsWhenNoRules() {
        when(ruleService.findAllEnabledWithChannels()).thenReturn(List.of());

        engine.evaluateAll();
    }

    @Test
    void evaluateAllEvaluatesEnabledRules() {
        AlertRuleEntity rule = createRule("test-rule", "event-count", Operator.GREATER_THAN, 100.0);
        when(ruleService.findAllEnabledWithChannels()).thenReturn(List.of(rule));

        PanelConfig panel = new PanelConfig("event-count", "Event Count", null, "streaming", PANEL_QUERY, "events/s", null);
        when(panelConfigLoader.loadPanels()).thenReturn(List.of(panel));

        var response = new PrometheusInstantQueryResponse("success",
                new PrometheusInstantQueryResponse.Data("vector", List.of(
                        new PrometheusInstantQueryResponse.Result(
                                Map.of("service_name", "pipeline-1"),
                                List.of(1234567890.0, "150.0")))));

        when(prometheusClient.query(
                org.mockito.ArgumentMatchers.eq("sum by (service_name) (rate(debezium_event_count_total{}[5m]))"),
                org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(response);

        when(stateManager.findByRuleId(rule.getId())).thenReturn(List.of());

        engine.evaluateAll();

        org.mockito.Mockito.verify(stateManager).evaluate(
                org.mockito.ArgumentMatchers.eq(rule),
                org.mockito.ArgumentMatchers.eq("pipeline-1"),
                org.mockito.ArgumentMatchers.eq(150.0),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.any(Instant.class));
    }

    @Test
    void evaluateAllKeepsFiringStateWhenPipelineDisappears() {
        AlertRuleEntity rule = createRule("test-rule", "event-count", Operator.GREATER_THAN, 100.0);
        when(ruleService.findAllEnabledWithChannels()).thenReturn(List.of(rule));

        PanelConfig panel = new PanelConfig("event-count", "Event Count", null, "streaming", PANEL_QUERY, "events/s", null);
        when(panelConfigLoader.loadPanels()).thenReturn(List.of(panel));

        var emptyResponse = new PrometheusInstantQueryResponse("success",
                new PrometheusInstantQueryResponse.Data("vector", List.of()));
        when(prometheusClient.query(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(emptyResponse);

        var orphanedState = new io.debezium.platform.data.model.AlertStateEntity();
        orphanedState.setRule(rule);
        orphanedState.setPipelineId("pipeline-gone");
        orphanedState.setState(AlertStateValue.FIRING);
        when(stateManager.findByRuleId(rule.getId())).thenReturn(List.of(orphanedState));

        engine.evaluateAll();

        org.mockito.Mockito.verify(stateManager, org.mockito.Mockito.never()).resolve(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void evaluateAllResolvesActiveStatesWhenPanelRemoved() {
        AlertRuleEntity rule = createRule("test-rule", "event-count", Operator.GREATER_THAN, 100.0);
        when(ruleService.findAllEnabledWithChannels()).thenReturn(List.of(rule));

        when(panelConfigLoader.loadPanels()).thenReturn(List.of());

        var firingState = new io.debezium.platform.data.model.AlertStateEntity();
        firingState.setRule(rule);
        firingState.setPipelineId("pipeline-1");
        firingState.setState(AlertStateValue.FIRING);
        when(stateManager.findByRuleId(rule.getId())).thenReturn(List.of(firingState));

        engine.evaluateAll();

        org.mockito.Mockito.verify(stateManager).resolve(
                org.mockito.ArgumentMatchers.eq(rule),
                org.mockito.ArgumentMatchers.eq(firingState),
                org.mockito.ArgumentMatchers.any(Instant.class));
    }

    @Test
    void evaluateAllDoesNotResolveOkStatesWhenPanelRemoved() {
        AlertRuleEntity rule = createRule("test-rule", "event-count", Operator.GREATER_THAN, 100.0);
        when(ruleService.findAllEnabledWithChannels()).thenReturn(List.of(rule));

        when(panelConfigLoader.loadPanels()).thenReturn(List.of());

        var okState = new io.debezium.platform.data.model.AlertStateEntity();
        okState.setRule(rule);
        okState.setPipelineId("pipeline-1");
        okState.setState(AlertStateValue.OK);
        when(stateManager.findByRuleId(rule.getId())).thenReturn(List.of(okState));

        engine.evaluateAll();

        org.mockito.Mockito.verify(stateManager, org.mockito.Mockito.never()).resolve(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());
    }

    private AlertRuleEntity createRule(String name, String panelId, Operator operator, double threshold) {
        AlertRuleEntity rule = new AlertRuleEntity();
        rule.setId(1L);
        rule.setName(name);
        rule.setPanelId(panelId);
        rule.setOperator(operator);
        rule.setThreshold(threshold);
        rule.setReduceFunction(ReduceFunction.LAST);
        rule.setEvaluationWindow("PT5M");
        rule.setForDuration("PT0S");
        rule.setSeverity(Severity.WARNING);
        rule.setEnabled(true);
        return rule;
    }
}
