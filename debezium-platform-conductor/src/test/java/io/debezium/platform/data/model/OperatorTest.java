/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class OperatorTest {

    @Test
    void testGreaterThan() {
        assertThat(Operator.GREATER_THAN.evaluate(10.0, 5.0)).isTrue();
        assertThat(Operator.GREATER_THAN.evaluate(5.0, 5.0)).isFalse();
        assertThat(Operator.GREATER_THAN.evaluate(3.0, 5.0)).isFalse();
    }

    @Test
    void testGreaterThanOrEqual() {
        assertThat(Operator.GREATER_THAN_OR_EQUAL.evaluate(10.0, 5.0)).isTrue();
        assertThat(Operator.GREATER_THAN_OR_EQUAL.evaluate(5.0, 5.0)).isTrue();
        assertThat(Operator.GREATER_THAN_OR_EQUAL.evaluate(3.0, 5.0)).isFalse();
    }

    @Test
    void testLessThan() {
        assertThat(Operator.LESS_THAN.evaluate(3.0, 5.0)).isTrue();
        assertThat(Operator.LESS_THAN.evaluate(5.0, 5.0)).isFalse();
        assertThat(Operator.LESS_THAN.evaluate(10.0, 5.0)).isFalse();
    }

    @Test
    void testLessThanOrEqual() {
        assertThat(Operator.LESS_THAN_OR_EQUAL.evaluate(3.0, 5.0)).isTrue();
        assertThat(Operator.LESS_THAN_OR_EQUAL.evaluate(5.0, 5.0)).isTrue();
        assertThat(Operator.LESS_THAN_OR_EQUAL.evaluate(10.0, 5.0)).isFalse();
    }

    @Test
    void testEqual() {
        assertThat(Operator.EQUAL.evaluate(5.0, 5.0)).isTrue();
        assertThat(Operator.EQUAL.evaluate(5.1, 5.0)).isFalse();
    }

    @Test
    void testNotEqual() {
        assertThat(Operator.NOT_EQUAL.evaluate(5.1, 5.0)).isTrue();
        assertThat(Operator.NOT_EQUAL.evaluate(5.0, 5.0)).isFalse();
    }

    @Test
    void testBoundaryValuesWithZero() {
        assertThat(Operator.GREATER_THAN.evaluate(0.0, 0.0)).isFalse();
        assertThat(Operator.EQUAL.evaluate(0.0, 0.0)).isTrue();
        assertThat(Operator.LESS_THAN.evaluate(0.0, 0.0)).isFalse();
    }

    @Test
    void testNegativeValues() {
        assertThat(Operator.LESS_THAN.evaluate(-5.0, -3.0)).isTrue();
        assertThat(Operator.GREATER_THAN.evaluate(-3.0, -5.0)).isTrue();
    }
}
