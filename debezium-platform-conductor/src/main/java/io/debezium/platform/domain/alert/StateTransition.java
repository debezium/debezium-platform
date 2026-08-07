/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import java.time.Instant;

import io.debezium.platform.data.model.AlertStateValue;

public record StateTransition(
        AlertStateValue newState,
        Action action,
        Instant pendingSince,
        Instant firedAt) {

    public enum Action {
        NONE,
        FIRE,
        RESOLVE
    }
}
