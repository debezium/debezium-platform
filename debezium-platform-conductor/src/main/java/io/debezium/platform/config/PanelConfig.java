/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PanelConfig(
        String id,
        String title,
        String description,
        String category,
        String query,
        String unit,
        Visualization visualization) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Visualization(String type, String suggestedStep) {
    }
}
