/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.model.AlertStateValue;

class AlertTransitionEvaluatorTest {

    private static final Instant NOW = Instant.parse("2026-07-30T10:00:00Z");
    private static final Duration ZERO = Duration.ZERO;
    private static final Duration FIVE_MINUTES = Duration.ofMinutes(5);

    AlertTransitionEvaluator evaluator;

    @BeforeEach
    void setUp() {
        evaluator = new AlertTransitionEvaluator();
    }

    @Test
    void okConditionNotMetStaysOk() {
        StateTransition result = evaluator.evaluate(AlertStateValue.OK, false, ZERO, null, NOW);

        assertThat(result.newState()).isEqualTo(AlertStateValue.OK);
        assertThat(result.action()).isEqualTo(StateTransition.Action.NONE);
        assertThat(result.pendingSince()).isNull();
        assertThat(result.firedAt()).isNull();
    }

    @Test
    void okConditionMetZeroForDurationFires() {
        StateTransition result = evaluator.evaluate(AlertStateValue.OK, true, ZERO, null, NOW);

        assertThat(result.newState()).isEqualTo(AlertStateValue.FIRING);
        assertThat(result.action()).isEqualTo(StateTransition.Action.FIRE);
        assertThat(result.firedAt()).isEqualTo(NOW);
    }

    @Test
    void okConditionMetWithForDurationTransitionsToPending() {
        StateTransition result = evaluator.evaluate(AlertStateValue.OK, true, FIVE_MINUTES, null, NOW);

        assertThat(result.newState()).isEqualTo(AlertStateValue.PENDING);
        assertThat(result.action()).isEqualTo(StateTransition.Action.NONE);
        assertThat(result.pendingSince()).isEqualTo(NOW);
    }

    @Test
    void pendingConditionNotMetReturnsToOk() {
        Instant pendingSince = NOW.minusSeconds(60);

        StateTransition result = evaluator.evaluate(AlertStateValue.PENDING, false, FIVE_MINUTES, pendingSince, NOW);

        assertThat(result.newState()).isEqualTo(AlertStateValue.OK);
        assertThat(result.action()).isEqualTo(StateTransition.Action.NONE);
        assertThat(result.pendingSince()).isNull();
    }

    @Test
    void pendingConditionMetNotExpiredStaysPending() {
        Instant pendingSince = NOW.minusSeconds(120);

        StateTransition result = evaluator.evaluate(AlertStateValue.PENDING, true, FIVE_MINUTES, pendingSince, NOW);

        assertThat(result.newState()).isEqualTo(AlertStateValue.PENDING);
        assertThat(result.action()).isEqualTo(StateTransition.Action.NONE);
        assertThat(result.pendingSince()).isEqualTo(pendingSince);
    }

    @Test
    void pendingConditionMetExpiredFires() {
        Instant pendingSince = NOW.minusSeconds(360);

        StateTransition result = evaluator.evaluate(AlertStateValue.PENDING, true, FIVE_MINUTES, pendingSince, NOW);

        assertThat(result.newState()).isEqualTo(AlertStateValue.FIRING);
        assertThat(result.action()).isEqualTo(StateTransition.Action.FIRE);
        assertThat(result.firedAt()).isEqualTo(NOW);
    }

    @Test
    void pendingConditionMetExactlyAtBoundaryFires() {
        Instant pendingSince = NOW.minus(FIVE_MINUTES);

        StateTransition result = evaluator.evaluate(AlertStateValue.PENDING, true, FIVE_MINUTES, pendingSince, NOW);

        assertThat(result.newState()).isEqualTo(AlertStateValue.FIRING);
        assertThat(result.action()).isEqualTo(StateTransition.Action.FIRE);
    }

    @Test
    void firingConditionMetStaysFiring() {
        StateTransition result = evaluator.evaluate(AlertStateValue.FIRING, true, ZERO, null, NOW);

        assertThat(result.newState()).isEqualTo(AlertStateValue.FIRING);
        assertThat(result.action()).isEqualTo(StateTransition.Action.NONE);
    }

    @Test
    void firingConditionNotMetResolves() {
        StateTransition result = evaluator.evaluate(AlertStateValue.FIRING, false, ZERO, null, NOW);

        assertThat(result.newState()).isEqualTo(AlertStateValue.OK);
        assertThat(result.action()).isEqualTo(StateTransition.Action.RESOLVE);
    }
}
