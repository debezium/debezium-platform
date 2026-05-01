/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import io.debezium.platform.data.dto.CollectionTree;
import io.debezium.platform.domain.views.Connection;

/**
 * Provides collection discovery for a source connection.
 * <p>
 * Implementations use the supplied connection configuration to inspect the
 * configured source system and return the available collections in a structured
 * tree representation.
 *
 * @author Philippe Camus
 */
public interface CollectionListingProvider {

    /**
     * Lists the collections available for the supplied source connection.
     *
     * @param connectionConfig the source connection configuration used to access
     *                         and inspect the source system
     * @return a tree containing the available catalogs, schemas, and collections;
     *         never {@code null}
     */
    CollectionTree listAvailableCollections(Connection connectionConfig);
}
