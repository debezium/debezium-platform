/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.configuration;

import java.util.Map;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.regex.Pattern;

import jakarta.enterprise.context.Dependent;

import io.debezium.platform.domain.views.flat.PipelineFlat;

@Dependent
public class TableNameResolver {

    private static final Map<String, Function<PipelineFlat, String>> PLACE_HOLDERS = Map.of("@{pipeline_name}", PipelineFlat::getName);

    public String resolve(PipelineFlat pipeline, String currentValue) {

        if (currentValue == null || currentValue.isEmpty()) {
            return currentValue;
        }

        String processedValue = PLACE_HOLDERS.entrySet().stream()
                .reduce(currentValue,
                        applyReplacementFunction(pipeline),
                        (lastProcessed, newProcessed) -> newProcessed);

        return sanitizeTableName(processedValue);
    }

    private BiFunction<String, Map.Entry<String, Function<PipelineFlat, String>>, String> applyReplacementFunction(PipelineFlat pipeline) {
        return (processedText, placeHolderMapping) -> processedText.replaceAll(
                Pattern.quote(placeHolderMapping.getKey()),
                placeHolderMapping.getValue().apply(pipeline));
    }

    /**
     * Sanitizes a string to be used as a PostgreSQL table name.
     * - Replaces invalid characters with underscores
     * - Ensures the name starts with a letter or underscore
     * - Truncates the name to 63 bytes (PostgreSQL's limit)
     *
     * @param tableName The original table name
     * @return A sanitized version safe for use as a PostgreSQL table name
     */
    private String sanitizeTableName(String tableName) {

        if (tableName == null || tableName.isEmpty()) {
            throw new IllegalArgumentException("Table name cannot be null or empty");
        }

        // PostgreSQL folds unquoted identifiers to lowercase
        String sanitized = tableName.toLowerCase();

        sanitized = sanitized.replaceAll("[^a-z0-9_]", "_");

        // Ensure the name starts with a letter or underscore
        if (!sanitized.matches("^[a-z_].*")) {
            sanitized = "_" + sanitized;
        }

        // Remove consecutive underscores
        sanitized = sanitized.replaceAll("_+", "_");

        // Trim trailing underscore
        sanitized = sanitized.replaceAll("_$", "");

        // Truncate to PostgreSQL's limit of 63 bytes
        if (sanitized.length() > 63) {
            sanitized = sanitized.substring(0, 63);
            // If we happened to end with an underscore after truncating, remove it
            sanitized = sanitized.replaceAll("_$", "");
        }

        return sanitized;
    }
}
