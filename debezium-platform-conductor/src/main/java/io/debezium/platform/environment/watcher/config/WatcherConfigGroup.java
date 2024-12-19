package io.debezium.platform.environment.watcher.config;

import io.debezium.platform.config.OffsetConfigGroup;
import io.quarkus.runtime.annotations.ConfigPhase;
import io.quarkus.runtime.annotations.ConfigRoot;
import io.smallrye.config.ConfigMapping;

import java.util.Optional;

@ConfigMapping(prefix = "conductor.watcher")
@ConfigRoot(prefix = "conductor", phase = ConfigPhase.RUN_TIME)
public interface WatcherConfigGroup {

    boolean enabled();

    Optional<String> crd();

    OffsetConfigGroup offset();

}
