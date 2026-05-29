/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import java.util.regex.Pattern;

import jakarta.enterprise.context.ApplicationScoped;

import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.config.PanelConfig;
import io.debezium.platform.data.dto.PanelQueryResponse;
import io.debezium.platform.data.dto.PanelResponse;
import io.debezium.platform.data.dto.PanelsListResponse;
import io.debezium.platform.data.dto.PrometheusQueryRangeResponse;
import io.debezium.platform.environment.actions.client.PrometheusClient;
import io.debezium.platform.error.NotFoundException;

@ApplicationScoped
public class MonitoringService {

    private static final Logger LOGGER = LoggerFactory.getLogger(MonitoringService.class);

    private static final Pattern PIPELINE_ID_PATTERN = Pattern.compile("[a-zA-Z0-9_-]+");
    private static final String PIPELINE_ID_PLACEHOLDER = "{{pipeline_id}}";

    private final PanelConfigLoader panelConfigLoader;
    private final PrometheusClient prometheusClient;

    public MonitoringService(PanelConfigLoader panelConfigLoader, @RestClient PrometheusClient prometheusClient) {
        this.panelConfigLoader = panelConfigLoader;
        this.prometheusClient = prometheusClient;
    }

    public PanelsListResponse listPanels() {
        List<PanelResponse> panels = panelConfigLoader.loadPanels().stream()
                .map(this::toPanelResponse)
                .toList();
        return new PanelsListResponse(panels);
    }

    public PanelQueryResponse queryPanel(String panelId, String pipelineId, String start, String end, String step) {
        PanelConfig panelConfig = panelConfigLoader.loadPanels().stream()
                .filter(p -> p.id().equals(panelId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Panel not found: " + panelId));

        validatePipelineId(pipelineId);
        validateRequired(start, "start");
        validateRequired(end, "end");

        String query = encodePromQLBraces(panelConfig.query().replace(PIPELINE_ID_PLACEHOLDER, pipelineId));

        if (step == null || step.isBlank()) {
            step = panelConfig.visualization().suggestedStep();
        }

        long startTime = System.currentTimeMillis();

        LOGGER.debug("Querying Prometheus for panel '{}', pipeline '{}': {}", panelId, pipelineId, query);

        PrometheusQueryRangeResponse prometheusResponse = prometheusClient.queryRange(query, start, end, step);

        long queryDuration = System.currentTimeMillis() - startTime;

        List<PanelQueryResponse.TimeSeries> series = transformResponse(prometheusResponse);

        return new PanelQueryResponse(
                panelId,
                pipelineId,
                new PanelQueryResponse.TimeRange(start, end, step),
                series,
                new PanelQueryResponse.Metadata(queryDuration));
    }

    private static void validateRequired(String value, String paramName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing required parameter: " + paramName);
        }
    }

    private static String encodePromQLBraces(String query) {
        return query.replace("{", "%7B").replace("}", "%7D");
    }

    private void validatePipelineId(String pipelineId) {
        if (pipelineId == null || !PIPELINE_ID_PATTERN.matcher(pipelineId).matches()) {
            throw new IllegalArgumentException("Invalid pipeline_id: must match pattern [a-zA-Z0-9_-]+");
        }
    }

    private List<PanelQueryResponse.TimeSeries> transformResponse(PrometheusQueryRangeResponse response) {
        if (response == null || response.data() == null || response.data().result() == null) {
            return Collections.emptyList();
        }

        return response.data().result().stream()
                .map(result -> new PanelQueryResponse.TimeSeries(
                        result.metric(),
                        toDatapoints(result.values())))
                .toList();
    }

    private List<double[]> toDatapoints(List<List<Object>> values) {
        if (values == null) {
            return Collections.emptyList();
        }

        return values.stream()
                .filter(pair -> pair != null && pair.size() >= 2)
                .map(toArray())
                .filter(Objects::nonNull)
                .toList();
    }

    private static Function<List<Object>, double[]> toArray() {
        return pair -> {
            try {
                return new double[]{
                        ((Number) pair.get(0)).doubleValue(),
                        Double.parseDouble(pair.get(1).toString())
                };
            }
            catch (NumberFormatException | ClassCastException e) {
                LOGGER.warn("Skipping malformed datapoint: {}", pair);
                return null;
            }
        };
    }

    private PanelResponse toPanelResponse(PanelConfig panelConfig) {
        return new PanelResponse(
                panelConfig.id(),
                panelConfig.title(),
                panelConfig.description(),
                panelConfig.category(),
                panelConfig.unit(),
                new PanelResponse.Visualization(
                        panelConfig.visualization().type(),
                        panelConfig.visualization().suggestedStep()));
    }
}
