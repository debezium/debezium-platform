/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.operator.configuration.common;

public record RedisWriteConfig(boolean enabled, Long timeoutMs, boolean retry, Long retryDelayMs) {
}