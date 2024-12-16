package io.debezium.platform.environment.watcher.config;

import io.smallrye.config.ConfigMapping;

import java.util.Map;
import java.util.Optional;

@ConfigMapping(prefix = "conductor.watcher")
public interface WatcherConfigGroup {

    boolean enabled();

    Optional<String> crd();

    OffsetConfigGroup offset();

    interface OffsetConfigGroup {
        OffsetStorageConfigGroup storage();
        Map<String, String> config();
    }
    interface OffsetStorageConfigGroup {
        String type();
        Map<String, String> config();
    }
}
