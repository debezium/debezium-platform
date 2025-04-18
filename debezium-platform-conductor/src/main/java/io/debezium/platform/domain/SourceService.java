/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static jakarta.transaction.Transactional.TxType.SUPPORTS;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Optional;

import io.debezium.platform.data.dto.SignalCollectionVerifyRequest;
import io.debezium.platform.data.dto.SignalDataCollectionVerifyResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.data.model.SourceEntity;
import io.debezium.platform.domain.views.Source;
import io.debezium.platform.domain.views.refs.SourceReference;
import io.debezium.platform.environment.actions.SignalDataCollectionChecker;
import io.debezium.relational.TableId;

@ApplicationScoped
public class SourceService extends AbstractService<SourceEntity, Source, SourceReference> {

    private static final Logger LOGGER = LoggerFactory.getLogger(SourceService.class);

    private static final String SIGNAL_DATA_COLLECTION_CONFIGURED_MESSAGE = "Signal data collection correctly configured";
    private static final String SIGNAL_DATA_COLLECTION_MISS_CONFIGURED_MESSAGE = "Signal data collection not present or miss configured";

    private final SignalDataCollectionChecker signalDataCollectionChecker;

    public SourceService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm, SignalDataCollectionChecker signalDataCollectionChecker) {
        super(SourceEntity.class, Source.class, SourceReference.class, em, cbf, evm);
        this.signalDataCollectionChecker = signalDataCollectionChecker;
    }

    @Transactional(SUPPORTS)
    public Optional<SourceReference> findReferenceById(Long id) {
        var result = evm.find(em, SourceReference.class, id);
        return Optional.ofNullable(result);
    }

    public SignalDataCollectionVerifyResponse verifySignalDataCollection(SignalCollectionVerifyRequest sourceConnectionConf) {

        try {
            var jdbcUrl = buildJdbcUrl(sourceConnectionConf);
            var conn = DriverManager.getConnection(jdbcUrl, sourceConnectionConf.username(), sourceConnectionConf.password());

            LOGGER.trace("Obtained connection to {}", jdbcUrl);
            var table = TableId.parse(sourceConnectionConf.fullyQualifiedTableName());

            boolean isConform = signalDataCollectionChecker.verifyTableStructure(conn, table.catalog(), table.schema(), table.table());

            String message = isConform ? SIGNAL_DATA_COLLECTION_CONFIGURED_MESSAGE : SIGNAL_DATA_COLLECTION_MISS_CONFIGURED_MESSAGE;

            return new SignalDataCollectionVerifyResponse(isConform, message);
        }
        catch (Exception e) {
            LOGGER.error("Unable to verify signal data collection", e);
            return new SignalDataCollectionVerifyResponse(false, e.getMessage());
        }

    }

    public String buildJdbcUrl(SignalCollectionVerifyRequest conf) {
        return switch (conf.databaseType()) {
            case ORACLE -> "jdbc:oracle:thin:@" + conf.hostname() + ":" + conf.port() + "/" + conf.dbName();
            case MYSQL -> "jdbc:mysql://" + conf.hostname() + ":" + conf.port() + "/" + conf.dbName();
            case MARIADB -> "jdbc:mariadb://" + conf.hostname() + ":" + conf.port() + "/" + conf.dbName();
            case SQLSERVER -> "jdbc:sqlserver://" + conf.hostname() + ":" + conf.port() + ";databaseName=" + conf.dbName();
            case POSTGRESQL -> "jdbc:postgresql://" + conf.hostname() + ":" + conf.port() + "/" + conf.dbName();
        };
    }

}
