/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ExecutionException;

import jakarta.inject.Named;

import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.DescribeClusterResult;
import org.apache.kafka.common.KafkaException;
import org.apache.kafka.common.errors.TimeoutException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionValidator;

/**
 * Implementation of {@link ConnectionValidator} for Apache Kafka connections.
 * <p>
 * This validator performs validation of Kafka connection configurations
 * including network connectivity and cluster accessibility.
 * </p>
 *
 * <p>
 * The validation process includes:
 * <ul>
 *   <li>Bootstrap servers connectivity verification</li>
 *   <li>Cluster metadata retrieval to confirm successful connection</li>
 *   <li>Timeout handling for network issues</li>
 * </ul>
 * </p>
 *
 * @author Mario Fiore Vitale
 */
@Named("KAFKA")
public class KafkaConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaConnectionValidator.class);

    private final int defaultConnectionTimeout;

    private static final String BOOTSTRAP_SERVERS_KEY = "bootstrap.servers";

    public KafkaConnectionValidator(@ConfigProperty(name = "destinations..kafka.connection.timeout") int defaultConnectionTimeout) {
        this.defaultConnectionTimeout = defaultConnectionTimeout;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        try {
            LOGGER.debug("Starting Kafka connection validation for connection: {}", connectionConfig.getName());

            Map<String, Object> kafkaConfig = connectionConfig.getConfig();

            if (!kafkaConfig.containsKey(BOOTSTRAP_SERVERS_KEY) ||
                    kafkaConfig.get(BOOTSTRAP_SERVERS_KEY) == null ||
                    kafkaConfig.get(BOOTSTRAP_SERVERS_KEY).toString().trim().isEmpty()) {
                return ConnectionValidationResult.failed("Bootstrap servers must be specified");
            }

            // Set reasonable timeout for validation
            kafkaConfig.put(AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, (int) Duration.ofSeconds(defaultConnectionTimeout).toMillis());
            kafkaConfig.put(AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, (int) Duration.ofSeconds(defaultConnectionTimeout).toMillis());

            return performConnectionValidation(kafkaConfig);

        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Kafka connection validation", e);
            return ConnectionValidationResult.failed("Validation failed due to unexpected error: " + e.getMessage());
        }
    }

    /**
     * Performs the actual connection validation by attempting to connect to Kafka
     * and retrieve cluster information.
     *
     * @param kafkaConfig the Kafka configuration properties
     * @return ConnectionValidationResult indicating success or failure
     */
    private ConnectionValidationResult performConnectionValidation(Map<String, Object> kafkaConfig) {
        AdminClient adminClient = null;

        try {
            LOGGER.debug("Creating Kafka AdminClient for validation");
            adminClient = AdminClient.create(kafkaConfig);

            LOGGER.debug("Attempting to describe Kafka cluster");
            DescribeClusterResult clusterResult = adminClient.describeCluster();

            String clusterId = clusterResult.clusterId().get();
            int nodeCount = clusterResult.nodes().get().size();

            LOGGER.debug("Successfully connected to Kafka cluster. Cluster ID: {}, Nodes: {}",
                    clusterId, nodeCount);

            return ConnectionValidationResult.successful();

        }
        catch (ExecutionException e) {
            Throwable cause = e.getCause();
            LOGGER.warn("Failed to connect to Kafka cluster", cause);

            return switch (cause) {
                case TimeoutException ignored -> ConnectionValidationResult.failed(
                        "Connection timeout - please check bootstrap servers and network connectivity");
                case org.apache.kafka.common.errors.SaslAuthenticationException ignored -> ConnectionValidationResult.failed(
                        "Authentication failed - please check SASL configuration and credentials");
                case org.apache.kafka.common.errors.SecurityDisabledException ignored -> ConnectionValidationResult.failed(
                        "Security protocol mismatch - cluster may not support the configured security protocol");
                case null, default -> ConnectionValidationResult.failed(
                        "Failed to connect to Kafka: " + e.getMessage());
            };

        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.warn("Kafka connection validation was interrupted", e);
            return ConnectionValidationResult.failed("Connection validation was interrupted");

        }
        catch (TimeoutException e) {
            LOGGER.warn("Timeout during Kafka connection validation", e);
            return ConnectionValidationResult.failed(
                    "Connection timeout - please check bootstrap servers and network connectivity");

        }
        catch (KafkaException e) {
            LOGGER.warn("Kafka-specific error during validation", e);
            return ConnectionValidationResult.failed("Kafka connection error");

        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Kafka connection validation", e);
            return ConnectionValidationResult.failed("Generic error while connecting to Kafka broker");

        }
        finally {
            if (adminClient != null) {
                try {
                    LOGGER.debug("Closing Kafka AdminClient");
                    adminClient.close(Duration.ofSeconds(defaultConnectionTimeout));
                }
                catch (Exception e) {
                    LOGGER.warn("Error closing Kafka AdminClient", e);
                }
            }
        }
    }
}
