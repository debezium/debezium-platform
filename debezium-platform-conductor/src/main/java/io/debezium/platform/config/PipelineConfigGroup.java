/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import io.quarkus.runtime.annotations.ConfigPhase;
import io.quarkus.runtime.annotations.ConfigRoot;
import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithName;

@ConfigMapping(prefix = "pipeline")
@ConfigRoot(phase = ConfigPhase.RUN_TIME)
public interface PipelineConfigGroup {

    OffsetConfigGroup offset();

    @WithName("schema.history")
    SchemaHistoryConfigGroup schema();

}
