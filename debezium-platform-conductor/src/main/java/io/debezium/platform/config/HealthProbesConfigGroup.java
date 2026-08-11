/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import io.smallrye.config.WithDefault;

public interface HealthProbesConfigGroup {

    LivenessConfigGroup liveness();

    ReadinessConfigGroup readiness();

    interface LivenessConfigGroup {

        @WithDefault("30")
        int initialDelaySeconds();

        @WithDefault("10")
        int periodSeconds();

        @WithDefault("10")
        int timeoutSeconds();

        @WithDefault("3")
        int failureThreshold();
    }

    interface ReadinessConfigGroup {

        @WithDefault("10")
        int initialDelaySeconds();

        @WithDefault("10")
        int periodSeconds();

        @WithDefault("10")
        int timeoutSeconds();

        @WithDefault("3")
        int failureThreshold();
    }
}
