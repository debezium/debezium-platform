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
import io.debezium.platform.environment.connection.source.SourceInspectionException;
import io.debezium.platform.environment.connection.source.SourceInspector;
import io.debezium.platform.environment.connection.source.SourceInspectorFactory;
import io.debezium.platform.error.NotFoundException;

@ApplicationScoped
public class ConnectionService extends AbstractService<ConnectionEntity, Connection, ConnectionReference> {

    private static final Logger LOGGER = LoggerFactory.getLogger(ConnectionService.class);
    public static final String CONNECTION_REFERENCE_ATTRIBUTE = "connection";

    private final SourceService sourceService;
    private final DestinationService destinationService;
    private final ConnectionValidatorFactory connectionValidatorFactory;
    private final SourceInspectorFactory sourceInspectorFactory;

    public ConnectionService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm,
                             SourceService sourceService, DestinationService destinationService,
                             ConnectionValidatorFactory connectionValidatorFactory,
                             SourceInspectorFactory sourceInspectorFactory) {
        super(ConnectionEntity.class, Connection.class, ConnectionReference.class, em, cbf, evm);

        this.sourceService = sourceService;
        this.destinationService = destinationService;
        this.connectionValidatorFactory = connectionValidatorFactory;
        this.sourceInspectorFactory = sourceInspectorFactory;
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

        try {
            SourceInspector sourceInspector = sourceInspectorFactory.getSourceInspector(connectionConfig.getType());

            return sourceInspector.listAvailableCollections(connectionConfig);
        }
        catch (SourceInspectionException e) {
            throw e;
        }
        catch (Exception e) {
            LOGGER.error("Unable to get available collections from connection {}", id, e);
            throw new SourceInspectionException("Unable to get available collections", e);
        }
    }

}
