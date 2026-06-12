/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform;

import java.util.Map;

public class HeartbeatTestProfile extends OutboxTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of("conductor.watcher.heartbeat.interval-ms", "2000");
    }
}
