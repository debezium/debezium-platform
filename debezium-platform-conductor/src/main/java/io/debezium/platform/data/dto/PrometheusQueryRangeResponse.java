/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.dto;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PrometheusQueryRangeResponse(String status, Data data) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Data(String resultType, List<Result> result) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Result(Map<String, String> metric, List<List<Object>> values) {
    }
}
