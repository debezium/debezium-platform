/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import java.util.List;

import io.quarkus.runtime.annotations.ConfigPhase;
import io.quarkus.runtime.annotations.ConfigRoot;
import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithName;

@ConfigMapping(prefix = "monitoring")
@ConfigRoot(phase = ConfigPhase.RUN_TIME)
public interface MonitoringApiConfigGroup {

    List<PanelConfig> panels();

    interface PanelConfig {
        String id();

        String title();

        String description();

        String category();

        String query();

        String unit();

        VisualizationConfig visualization();
    }

    interface VisualizationConfig {
        String type();

        @WithName("suggested-step")
        String suggestedStep();
    }
}
