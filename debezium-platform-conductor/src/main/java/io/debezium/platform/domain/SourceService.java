/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static jakarta.transaction.Transactional.TxType.SUPPORTS;

import java.util.Optional;

import io.debezium.platform.environment.connection.source.SourceInspector;
import io.debezium.platform.environment.connection.source.SourceInspectorFactory;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.data.dto.SignalCollectionVerifyRequest;
import io.debezium.platform.data.dto.SignalDataCollectionVerifyResponse;
import io.debezium.platform.data.model.SourceEntity;
import io.debezium.platform.domain.views.Source;
import io.debezium.platform.domain.views.refs.SourceReference;

@ApplicationScoped
public class SourceService extends AbstractService<SourceEntity, Source, SourceReference> {

    private static final Logger LOGGER = LoggerFactory.getLogger(SourceService.class);

    private final SourceInspectorFactory sourceInspectorFactory;

    public SourceService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm,
                         SourceInspectorFactory sourceInspectorFactory) {
        super(SourceEntity.class, Source.class, SourceReference.class, em, cbf, evm);
        this.sourceInspectorFactory = sourceInspectorFactory;
    }

    @Transactional(SUPPORTS)
    public Optional<SourceReference> findReferenceById(Long id) {
        var result = evm.find(em, SourceReference.class, id);
        return Optional.ofNullable(result);
    }

    public SignalDataCollectionVerifyResponse verifySignalDataCollection(SignalCollectionVerifyRequest signalCollectionVerifyRequest) {

        try {
            SourceInspector sourceInspector =
                    sourceInspectorFactory.getSourceInspector(signalCollectionVerifyRequest.getConnectionType());

            return sourceInspector.verifyDataCollectionStructure(signalCollectionVerifyRequest);
        } catch (Exception e) {
            LOGGER.error("Failed to verify signal data collection structure: {}", e.getMessage(), e);
            return new SignalDataCollectionVerifyResponse(false, e.getMessage());
        }


    }
}
