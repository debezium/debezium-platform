package io.debezium.platform.environment.watcher.config;

import io.smallrye.config.ConfigMapping;

import java.util.Optional;

@ConfigMapping(prefix = "conductor.watcher")
public interface WatcherConfigGroup {

    boolean enabled();

    Optional<String> crd();

    OffsetConfigGroup offset();

    interface OffsetConfigGroup {
        String storage();
        String file();
    }
}
