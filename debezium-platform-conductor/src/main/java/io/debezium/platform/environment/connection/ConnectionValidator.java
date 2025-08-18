/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import io.debezium.common.annotation.Incubating;
import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;

/**
 * Interface for validating connections to various systems within the Debezium platform.
 * <p>
 * This interface defines the contract for implementing connection validation logic
 * that can verify the correctness and accessibility of connections to both source
 * and destination systems used in a pipeline.
 * </p>
 *
 * <p>
 * The validator supports connections to various types of systems including:
 * <ul>
 *   <li><strong>Source systems:</strong> Databases (PostgreSQL, MySQL, Oracle, etc.),
 *       message brokers, file systems, and other data sources</li>
 *   <li><strong>Destination systems:</strong> Apache Kafka, Redis, Elasticsearch,
 *       cloud storage services, and other sink destinations for Debezium Server</li>
 * </ul>
 * </p>
 *
 * <p>
 * Implementations of this interface should handle various aspects of connection
 * validation including but not limited to:
 * <ul>
 *   <li>Network connectivity verification</li>
 *   <li>Authentication and authorization checks</li>
 *   <li>System-specific configuration validation</li>
 *   <li>Required permissions and access rights verification</li>
 *   <li>Protocol compatibility and version checks</li>
 * </ul>
 * </p>
 *
 * @author Mario Fiore Vitale
 */
@Incubating
public interface ConnectionValidator {

    /**
     * Validates the provided connection configuration.
     * <p>
     * This method performs comprehensive validation of the connection configuration
     * to ensure it is properly configured and can establish a successful connection
     * to the target system (source or destination).
     * </p>
     *
     * @param connectionConfig the connection configuration to validate, must not be null
     * @return a {@link ConnectionValidationResult} containing the validation outcome,
     *         including success/failure status and any error messages or warnings
     *
     * @see ConnectionValidationResult
     * @see Connection
     */
    ConnectionValidationResult validate(Connection connectionConfig);
}