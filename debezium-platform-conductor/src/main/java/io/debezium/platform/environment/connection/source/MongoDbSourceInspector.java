package io.debezium.platform.environment.connection.source;

import io.debezium.platform.data.dto.CollectionTree;
import io.debezium.platform.data.dto.SignalCollectionVerifyRequest;
import io.debezium.platform.data.dto.SignalDataCollectionVerifyResponse;
import io.debezium.platform.domain.views.Connection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

@ApplicationScoped
@Named("MONGODB_SOURCE_INSPECTOR")
public class MongoDbSourceInspector implements SourceInspector {
    @Override
    public CollectionTree listAvailableCollections(Connection connectionConfig) {
        return null;
    }

    @Override
    public SignalDataCollectionVerifyResponse verifyDataCollectionStructure(SignalCollectionVerifyRequest request) {
        return new SignalDataCollectionVerifyResponse(false, "MongoDB signal data collection verification is not implemented yet");
    }
}
