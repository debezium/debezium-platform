/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import java.time.Duration;
import java.time.Instant;

import jakarta.enterprise.context.ApplicationScoped;

import io.debezium.platform.data.model.AlertStateValue;

@ApplicationScoped
public class AlertTransitionEvaluator {

    public StateTransition evaluate(AlertStateValue currentState, boolean conditionMet,
                                    Duration forDuration, Instant pendingSince, Instant now) {
        return switch (currentState) {
            case OK -> evaluateOk(conditionMet, forDuration, now);
            case PENDING -> evaluatePending(conditionMet, forDuration, pendingSince, now);
            case FIRING -> evaluateFiring(conditionMet);
        };
    }

    private StateTransition evaluateOk(boolean conditionMet, Duration forDuration, Instant now) {
        if (!conditionMet) {
            return new StateTransition(AlertStateValue.OK, StateTransition.Action.NONE, null, null);
        }
        if (forDuration.isZero()) {
            return new StateTransition(AlertStateValue.FIRING, StateTransition.Action.FIRE, null, now);
        }
        return new StateTransition(AlertStateValue.PENDING, StateTransition.Action.NONE, now, null);
    }

    private StateTransition evaluatePending(boolean conditionMet, Duration forDuration,
                                            Instant pendingSince, Instant now) {
        if (!conditionMet) {
            return new StateTransition(AlertStateValue.OK, StateTransition.Action.NONE, null, null);
        }
        if (Duration.between(pendingSince, now).compareTo(forDuration) >= 0) {
            return new StateTransition(AlertStateValue.FIRING, StateTransition.Action.FIRE, null, now);
        }
        return new StateTransition(AlertStateValue.PENDING, StateTransition.Action.NONE, pendingSince, null);
    }

    private StateTransition evaluateFiring(boolean conditionMet) {
        if (!conditionMet) {
            return new StateTransition(AlertStateValue.OK, StateTransition.Action.RESOLVE, null, null);
        }
        return new StateTransition(AlertStateValue.FIRING, StateTransition.Action.NONE, null, null);
    }
}
