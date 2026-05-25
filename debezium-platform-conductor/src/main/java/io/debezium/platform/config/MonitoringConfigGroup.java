/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import java.util.Optional;

public interface MonitoringConfigGroup {

    OtelConfigGroup otel();

    interface OtelConfigGroup {
        boolean enabled();

        Optional<String> endpoint();
    }
}
