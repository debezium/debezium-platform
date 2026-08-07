/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

public enum ReduceFunction {
    LAST,
    AVG,
    MIN,
    MAX,
    SUM;

    public String wrapQuery(String query, String window) {
        return switch (this) {
            case LAST -> query;
            case AVG -> "avg_over_time((" + query + ")[" + window + ":])";
            case MIN -> "min_over_time((" + query + ")[" + window + ":])";
            case MAX -> "max_over_time((" + query + ")[" + window + ":])";
            case SUM -> "sum_over_time((" + query + ")[" + window + ":])";
        };
    }
}
