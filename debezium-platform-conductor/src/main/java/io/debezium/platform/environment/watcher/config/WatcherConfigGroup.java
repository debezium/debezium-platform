/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.watcher.config;

import java.util.Optional;

import io.debezium.platform.config.OffsetConfigGroup;
import io.quarkus.runtime.annotations.ConfigPhase;
import io.quarkus.runtime.annotations.ConfigRoot;
import io.smallrye.config.ConfigMapping;

@ConfigMapping(prefix = "conductor.watcher")
@ConfigRoot(prefix = "conductor", phase = ConfigPhase.RUN_TIME)
public interface WatcherConfigGroup {

    boolean enabled();

    Optional<String> crd();

    OffsetConfigGroup offset();

}
