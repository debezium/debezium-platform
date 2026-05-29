/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.dto;

import java.util.List;
import java.util.Map;

public record PanelQueryResponse(
        String panelId,
        String pipelineId,
        TimeRange timeRange,
        List<TimeSeries> series,
        Metadata metadata) {

    public record TimeRange(String start, String end, String step) {
    }

    public record TimeSeries(Map<String, String> labels, List<double[]> datapoints) {
    }

    public record Metadata(long queryDurationMs) {
    }
}
