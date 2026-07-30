/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.data.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ReduceFunctionTest {

    private static final String BASE_QUERY = "rate(debezium_event_count_total[5m])";
    private static final String WINDOW = "10m";

    @Test
    void lastReturnsUnwrappedQuery() {
        assertThat(ReduceFunction.LAST.wrapQuery(BASE_QUERY, WINDOW))
                .isEqualTo(BASE_QUERY);
    }

    @Test
    void avgWrapsWithAvgOverTime() {
        assertThat(ReduceFunction.AVG.wrapQuery(BASE_QUERY, WINDOW))
                .isEqualTo("avg_over_time((" + BASE_QUERY + ")[" + WINDOW + ":])");
    }

    @Test
    void minWrapsWithMinOverTime() {
        assertThat(ReduceFunction.MIN.wrapQuery(BASE_QUERY, WINDOW))
                .isEqualTo("min_over_time((" + BASE_QUERY + ")[" + WINDOW + ":])");
    }

    @Test
    void maxWrapsWithMaxOverTime() {
        assertThat(ReduceFunction.MAX.wrapQuery(BASE_QUERY, WINDOW))
                .isEqualTo("max_over_time((" + BASE_QUERY + ")[" + WINDOW + ":])");
    }

    @Test
    void sumWrapsWithSumOverTime() {
        assertThat(ReduceFunction.SUM.wrapQuery(BASE_QUERY, WINDOW))
                .isEqualTo("sum_over_time((" + BASE_QUERY + ")[" + WINDOW + ":])");
    }
}
