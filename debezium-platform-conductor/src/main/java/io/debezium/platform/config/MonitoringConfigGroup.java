/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import java.util.Optional;

import io.smallrye.config.WithDefault;
import io.smallrye.config.WithName;

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

        /**
         * Returns the interval in milliseconds at which the OTel JMX agent scrapes MBeans.
         *
         * @return the JMX scrape interval in milliseconds
         */
        @WithDefault("1000")
        @WithName("jmx-interval-ms")
        int jmxIntervalMs();

        /**
         * Returns the interval in milliseconds at which the OTel SDK exports metrics via OTLP.
         *
         * @return the metric export interval in milliseconds
         */
        @WithDefault("5000")
        @WithName("metric-export-interval-ms")
        int metricExportIntervalMs();

        /**
         * Indicates whether pipelines export traces to the OpenTelemetry Collector.
         * <p>
         * Enable it only when the collector behind {@link #endpoint()} has a traces pipeline.
         * </p>
         *
         * @return {@code true} if pipelines export traces, {@code false} otherwise
         */
        @WithDefault("false")
        @WithName("traces-enabled")
        boolean tracesEnabled();

        /**
         * Indicates whether pipelines export logs to the OpenTelemetry Collector.
         * <p>
         * Enable it only when the collector behind {@link #endpoint()} has a logs pipeline.
         * </p>
         *
         * @return {@code true} if pipelines export logs, {@code false} otherwise
         */
        @WithDefault("false")
        @WithName("logs-enabled")
        boolean logsEnabled();
    }
}
