/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.dto;

public record PanelResponse(
        String id,
        String title,
        String description,
        String category,
        String unit,
        Visualization visualization) {

    public record Visualization(String type, String suggestedStep) {
    }
}
