/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

public enum Operator {
    GREATER_THAN,
    GREATER_THAN_OR_EQUAL,
    LESS_THAN,
    LESS_THAN_OR_EQUAL,
    EQUAL,
    NOT_EQUAL;

    public boolean evaluate(double value, double threshold) {
        return switch (this) {
            case GREATER_THAN -> value > threshold;
            case GREATER_THAN_OR_EQUAL -> value >= threshold;
            case LESS_THAN -> value < threshold;
            case LESS_THAN_OR_EQUAL -> value <= threshold;
            case EQUAL -> Double.compare(value, threshold) == 0;
            case NOT_EQUAL -> Double.compare(value, threshold) != 0;
        };
    }
}
