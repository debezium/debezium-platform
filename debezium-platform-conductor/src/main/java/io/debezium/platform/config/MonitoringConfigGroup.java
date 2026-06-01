/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import java.util.Optional;

/**
 * Configuration group for monitoring and observability features.
 * <p>
 * This interface defines the configuration structure for enabling and configuring
 * monitoring capabilities in the Debezium Platform, including OpenTelemetry integration
 * for metrics collection and export.
 * </p>
 *
 * @author Debezium Authors
 */
public interface MonitoringConfigGroup {

    /**
     * Returns the OpenTelemetry configuration group.
     *
     * @return the OpenTelemetry configuration settings
     */
    OtelConfigGroup otel();

    /**
     * Configuration group for OpenTelemetry (OTel) integration.
     * <p>
     * Defines settings for enabling and configuring OpenTelemetry metrics collection
     * and export. When enabled, the platform will expose metrics that can be sent to an
     * OpenTelemetry Collector endpoint.
     * </p>
     */
    interface OtelConfigGroup {
        /**
         * Indicates whether OpenTelemetry metrics collection is enabled.
         *
         * @return {@code true} if OpenTelemetry is enabled, {@code false} otherwise
         */
        boolean enabled();

        /**
         * Returns the OpenTelemetry Collector endpoint URL.
         * <p>
         * This endpoint is used to export metrics to an OpenTelemetry Collector.
         * </p>
         *
         * @return an {@link Optional} containing the endpoint URL if configured, or empty if not set
         */
        Optional<String> endpoint();
    }
}
