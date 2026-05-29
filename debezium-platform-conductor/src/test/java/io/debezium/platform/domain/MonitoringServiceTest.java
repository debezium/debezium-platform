/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.debezium.platform.config.PanelConfig;
import io.debezium.platform.data.dto.PanelQueryResponse;
import io.debezium.platform.data.dto.PanelsListResponse;
import io.debezium.platform.data.dto.PrometheusQueryRangeResponse;
import io.debezium.platform.environment.actions.client.PrometheusClient;
import io.debezium.platform.error.NotFoundException;

@ExtendWith(MockitoExtension.class)
class MonitoringServiceTest {

    private static final PanelConfig EVENT_COUNT_PANEL = new PanelConfig(
            "event-count",
            "Event Count",
            "Rate of events",
            "streaming",
            "rate(debezium_event_count_total{service_name=\"{{pipeline_id}}\"}[5m])",
            "events/s",
            new PanelConfig.Visualization("line", "15s"));

    @Mock
    PanelConfigLoader panelConfigLoader;

    @Mock
    PrometheusClient prometheusClient;

    MonitoringService service;

    @BeforeEach
    void setUp() {
        service = new MonitoringService(panelConfigLoader, prometheusClient);
    }

    @Test
    void listPanelsReturnsConfiguredPanels() {
        when(panelConfigLoader.loadPanels()).thenReturn(List.of(EVENT_COUNT_PANEL));

        PanelsListResponse response = service.listPanels();

        assertThat(response.panels()).hasSize(1);
        assertThat(response.panels().get(0).id()).isEqualTo("event-count");
        assertThat(response.panels().get(0).title()).isEqualTo("Event Count");
        assertThat(response.panels().get(0).visualization().type()).isEqualTo("line");
    }

    @Test
    void queryPanelSubstitutesPipelineId() {
        when(panelConfigLoader.loadPanels()).thenReturn(List.of(EVENT_COUNT_PANEL));

        PrometheusQueryRangeResponse prometheusResponse = new PrometheusQueryRangeResponse(
                "success",
                new PrometheusQueryRangeResponse.Data("matrix", List.of(
                        new PrometheusQueryRangeResponse.Result(
                                Map.of("service_name", "my-pipeline"),
                                List.of(
                                        List.of(1745414100, "35.2"),
                                        List.of(1745414160, "37.8"))))));

        when(prometheusClient.queryRange(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(prometheusResponse);

        PanelQueryResponse response = service.queryPanel(
                "event-count", "my-pipeline", "2026-04-23T10:00:00Z", "2026-04-23T11:00:00Z", "1m");

        verify(prometheusClient).queryRange(
                eq("rate(debezium_event_count_total%7Bservice_name=\"my-pipeline\"%7D[5m])"),
                eq("2026-04-23T10:00:00Z"),
                eq("2026-04-23T11:00:00Z"),
                eq("1m"));

        assertThat(response.panelId()).isEqualTo("event-count");
        assertThat(response.pipelineId()).isEqualTo("my-pipeline");
        assertThat(response.series()).hasSize(1);
        assertThat(response.series().get(0).datapoints()).hasSize(2);
        assertThat(response.series().get(0).datapoints().get(0)[0]).isEqualTo(1745414100);
        assertThat(response.series().get(0).datapoints().get(0)[1]).isEqualTo(35.2);
    }

    @Test
    void queryPanelUsesDefaultStepWhenNotProvided() {
        when(panelConfigLoader.loadPanels()).thenReturn(List.of(EVENT_COUNT_PANEL));

        when(prometheusClient.queryRange(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new PrometheusQueryRangeResponse("success",
                        new PrometheusQueryRangeResponse.Data("matrix", List.of())));

        service.queryPanel("event-count", "my-pipeline", "2026-04-23T10:00:00Z", "2026-04-23T11:00:00Z", null);

        verify(prometheusClient).queryRange(anyString(), anyString(), anyString(), eq("15s"));
    }

    @Test
    void queryPanelThrowsNotFoundForUnknownPanel() {
        when(panelConfigLoader.loadPanels()).thenReturn(List.of());

        assertThatThrownBy(() -> service.queryPanel(
                "unknown-panel", "my-pipeline", "2026-04-23T10:00:00Z", "2026-04-23T11:00:00Z", "1m"))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("unknown-panel");
    }

    @Test
    void queryPanelHandlesEmptyPrometheusResponse() {
        when(panelConfigLoader.loadPanels()).thenReturn(List.of(EVENT_COUNT_PANEL));

        when(prometheusClient.queryRange(anyString(), anyString(), anyString(), anyString()))
                .thenReturn(new PrometheusQueryRangeResponse("success",
                        new PrometheusQueryRangeResponse.Data("matrix", List.of())));

        PanelQueryResponse response = service.queryPanel(
                "event-count", "my-pipeline", "2026-04-23T10:00:00Z", "2026-04-23T11:00:00Z", "1m");

        assertThat(response.series()).isEmpty();
    }
}
