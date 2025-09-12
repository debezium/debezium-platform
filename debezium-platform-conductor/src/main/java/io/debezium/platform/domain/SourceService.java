/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static jakarta.transaction.Transactional.TxType.SUPPORTS;

import java.util.Optional;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.jdbc.JdbcConnection;
import io.debezium.platform.data.dto.SignalCollectionVerifyRequest;
import io.debezium.platform.data.dto.SignalDataCollectionVerifyResponse;
import io.debezium.platform.data.model.SourceEntity;
import io.debezium.platform.domain.views.Source;
import io.debezium.platform.domain.views.refs.SourceReference;
import io.debezium.platform.environment.actions.SignalDataCollectionChecker;
import io.debezium.platform.environment.database.DatabaseConnectionFactory;
import io.debezium.relational.TableId;

@ApplicationScoped
public class SourceService extends AbstractService<SourceEntity, Source, SourceReference> {

    private static final Logger LOGGER = LoggerFactory.getLogger(SourceService.class);

    private static final String SIGNAL_DATA_COLLECTION_CONFIGURED_MESSAGE = "Signal data collection correctly configured";
    private static final String SIGNAL_DATA_COLLECTION_MISS_CONFIGURED_MESSAGE = "Signal data collection not present or misconfigured";

    private final SignalDataCollectionChecker signalDataCollectionChecker;
    private final DatabaseConnectionFactory databaseConnectionFactory;

    public SourceService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm, SignalDataCollectionChecker signalDataCollectionChecker,
                         DatabaseConnectionFactory databaseConnectionFactory) {
        super(SourceEntity.class, Source.class, SourceReference.class, em, cbf, evm);
        this.signalDataCollectionChecker = signalDataCollectionChecker;
        this.databaseConnectionFactory = databaseConnectionFactory;
    }

    @Transactional(SUPPORTS)
    public Optional<SourceReference> findReferenceById(Long id) {
        var result = evm.find(em, SourceReference.class, id);
        return Optional.ofNullable(result);
    }

    public SignalDataCollectionVerifyResponse verifySignalDataCollection(SignalCollectionVerifyRequest signalCollectionVerifyRequest) {

        try (JdbcConnection jdbcConnection = databaseConnectionFactory.create(signalCollectionVerifyRequest.connectionConfig())) {

            var table = TableId.parse(signalCollectionVerifyRequest.fullyQualifiedTableName(), false);

            boolean isConform = signalDataCollectionChecker.verifyTableStructure(jdbcConnection.connection(), signalCollectionVerifyRequest.connectionConfig().database(),
                    table.schema(),
                    table.table());

            String message = isConform ? SIGNAL_DATA_COLLECTION_CONFIGURED_MESSAGE : SIGNAL_DATA_COLLECTION_MISS_CONFIGURED_MESSAGE;

            return new SignalDataCollectionVerifyResponse(isConform, message);
        }
        catch (Exception e) {
            LOGGER.error("Unable to verify signal data collection", e);
            return new SignalDataCollectionVerifyResponse(false, e.getMessage());
        }

    }
}
