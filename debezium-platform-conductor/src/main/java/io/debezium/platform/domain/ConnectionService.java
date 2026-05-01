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
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.data.dto.CollectionTree;
import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.domain.views.refs.ConnectionReference;
import io.debezium.platform.environment.connection.ConnectionValidator;
import io.debezium.platform.environment.connection.ConnectionValidatorFactory;
import io.debezium.platform.environment.connection.source.CollectionListingProvider;
import io.debezium.platform.environment.connection.source.CollectionListingProviderFactory;
import io.debezium.platform.error.NotFoundException;

@ApplicationScoped
public class ConnectionService extends AbstractService<ConnectionEntity, Connection, ConnectionReference> {

    private static final Logger LOGGER = LoggerFactory.getLogger(ConnectionService.class);
    public static final String CONNECTION_REFERENCE_ATTRIBUTE = "connection";

    private final SourceService sourceService;
    private final DestinationService destinationService;
    private final ConnectionValidatorFactory connectionValidatorFactory;
    private final CollectionListingProviderFactory collectionListingProviderFactory;

    public ConnectionService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm,
                             SourceService sourceService, DestinationService destinationService,
                             CollectionListingProviderFactory collectionListingProviderFactory,
                             ConnectionValidatorFactory connectionValidatorFactory) {
        super(ConnectionEntity.class, Connection.class, ConnectionReference.class, em, cbf, evm);

        this.sourceService = sourceService;
        this.destinationService = destinationService;
        this.connectionValidatorFactory = connectionValidatorFactory;
        this.collectionListingProviderFactory = collectionListingProviderFactory;
    }

    @Transactional(SUPPORTS)
    public Optional<ConnectionReference> findReferenceById(Long id) {
        var result = evm.find(em, ConnectionReference.class, id);
        return Optional.ofNullable(result);
    }

    @Override
    @Transactional(Transactional.TxType.REQUIRED)
    public void onChange(Connection connection) {
        sourceService.findViewByReference(CONNECTION_REFERENCE_ATTRIBUTE, connection.getId())
                .forEach(sourceService::onChange);
        destinationService.findViewByReference(CONNECTION_REFERENCE_ATTRIBUTE, connection.getId())
                .forEach(destinationService::onChange);
    }

    public ConnectionValidationResult validateConnection(@NotNull @Valid Connection connection) {

        ConnectionValidator connectionValidator = connectionValidatorFactory.getValidator(connection.getType().name());

        return connectionValidator.validate(connection);
    }

    public CollectionTree listAvailableCollections(Long id) {

        Connection connectionConfig = findById(id).orElseThrow(() -> new NotFoundException(id));

        CollectionListingProvider collectionListingProvider = collectionListingProviderFactory.getCollectionListingProvider(connectionConfig.getType().name());

        return collectionListingProvider.listAvailableCollections(connectionConfig);
    }

}
