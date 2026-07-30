/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.monitoring;

import java.util.HashMap;
import java.util.Map;

public class AlertEvaluationTestResource extends PrometheusTestResource {

    @Override
    public Map<String, String> start() {
        Map<String, String> config = new HashMap<>(super.start());
        config.put("alerting.evaluation.interval", "2s");
        config.put("test.metrics-endpoint.port", String.valueOf(metricsEndpoint.getPort()));
        return config;
    }
}
