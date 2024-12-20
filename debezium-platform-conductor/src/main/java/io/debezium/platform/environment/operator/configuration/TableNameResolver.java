/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.configuration;

import io.debezium.platform.domain.views.flat.PipelineFlat;
import jakarta.enterprise.context.Dependent;

@Dependent
public class TableNameResolver {


    public String resolve(PipelineFlat pipeline, String offsetSuffix) {

        return String.format("%s_%s", sanitizeTableName(pipeline.getName()), offsetSuffix);
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
    private static String sanitizeTableName(String tableName) {

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
