/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import java.time.Duration;

import io.quarkus.runtime.annotations.ConfigPhase;
import io.quarkus.runtime.annotations.ConfigRoot;
import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.smallrye.config.WithName;

@ConfigMapping(prefix = "alerting")
@ConfigRoot(phase = ConfigPhase.RUN_TIME)
public interface AlertingConfigGroup {

    EvaluationConfigGroup evaluation();

    HistoryConfigGroup history();

    WebhookConfigGroup webhook();

    interface EvaluationConfigGroup {

        @WithDefault("60s")
        String interval();
    }

    interface HistoryConfigGroup {

        @WithDefault("30d")
        Duration retention();

        CleanupConfigGroup cleanup();

        interface CleanupConfigGroup {

            @WithDefault("24h")
            String interval();
        }
    }

    interface WebhookConfigGroup {

        @WithDefault("3")
        @WithName("max-attempts")
        int maxAttempts();

        @WithDefault("5S")
        @WithName("connect-timeout")
        Duration connectTimeout();

        @WithDefault("10S")
        @WithName("read-timeout")
        Duration readTimeout();

        @WithDefault("false")
        @WithName("allow-private-networks")
        boolean allowPrivateNetworks();
    }
}
