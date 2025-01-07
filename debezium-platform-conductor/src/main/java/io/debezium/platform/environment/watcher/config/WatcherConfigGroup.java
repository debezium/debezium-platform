/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.watcher.config;

import java.util.Map;
import java.util.Optional;

import io.smallrye.config.ConfigMapping;

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
