/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import io.debezium.platform.data.dto.CollectionTree;
import io.debezium.platform.data.dto.SignalDataCollectionVerifyResponse;
import io.debezium.platform.domain.views.Connection;

/**
 * Interface for inspecting source data systems within the Debezium platform.
 * <p>
 * This interface defines the contract for implementing source inspection logic
 * that can discover available data collections and verify the structure of
 * specific collections required by Debezium features.
 * </p>
 *
 * <p>
 * Source inspectors are responsible for reading metadata from source systems and
 * representing it in a platform-neutral format. Implementations may support
 * different source technologies, including relational databases, document
 * databases, and other systems that expose collections of data.
 * </p>
 *
 * <p>
 * Implementations of this interface should handle source-specific inspection
 * concerns including but not limited to:
 * <ul>
 *   <li>Discovering catalogs, schemas, tables, collections, or equivalent source objects</li>
 *   <li>Building a hierarchical representation of available collections</li>
 *   <li>Verifying that a signal data collection exists and has the expected structure</li>
 *   <li>Handling source-specific metadata formats and naming rules</li>
 *   <li>Reporting inspection or verification failures in a consistent way</li>
 * </ul>
 * </p>
 *
 * @author Philippe Camus
 */
public interface SourceInspector {
    /**
     * Lists the collections available for the provided source connection configuration.
     * <p>
     * This method inspects the source system described by the connection configuration
     * and returns the available data collections as a hierarchical tree. Depending on
     * the source type, the tree may represent catalogs, schemas, tables, collections,
     * or equivalent source-specific structures.
     * </p>
     *
     * @param connectionConfig the source connection configuration to inspect, must not be null
     * @return a {@link CollectionTree} containing the available source collections
     *
     * @see CollectionTree
     * @see Connection
     */
    CollectionTree listAvailableCollections(Connection connectionConfig);

    /**
     * Verifies the structure of a signal data collection in the provided source system.
     * <p>
     * This method checks whether the collection identified by the fully qualified name
     * exists in the source system and conforms to the expected structure required for
     * Debezium signal data collections.
     * </p>
     *
     * @param connection the source connection configuration to use for verification, must not be null
     * @param fullyQualifiedTableName the fully qualified name of the signal data collection to verify,
     *        must not be null or blank
     * @return a {@link SignalDataCollectionVerifyResponse} containing the verification outcome,
     *         including success/failure status and an explanatory message
     *
     * @see SignalDataCollectionVerifyResponse
     * @see Connection
     */
    SignalDataCollectionVerifyResponse verifyDataCollectionStructure(Connection connection,
                                                                     String fullyQualifiedTableName);

}
