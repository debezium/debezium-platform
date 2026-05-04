/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import io.debezium.platform.data.dto.CollectionTree;
import io.debezium.platform.data.dto.SignalCollectionVerifyRequest;
import io.debezium.platform.data.dto.SignalDataCollectionVerifyResponse;
import io.debezium.platform.domain.views.Connection;

public interface SourceInspector {
    CollectionTree listAvailableCollections(Connection connectionConfig);

    SignalDataCollectionVerifyResponse verifyDataCollectionStructure(SignalCollectionVerifyRequest request);

}
