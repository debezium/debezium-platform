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

import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.domain.views.refs.ConnectionReference;

@ApplicationScoped
public class ConnectionService extends AbstractService<ConnectionEntity, Connection, ConnectionReference> {

    private static final Logger LOGGER = LoggerFactory.getLogger(ConnectionService.class);

    public ConnectionService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm) {
        super(ConnectionEntity.class, Connection.class, ConnectionReference.class, em, cbf, evm);

    }

    @Transactional(SUPPORTS)
    public Optional<ConnectionReference> findReferenceById(Long id) {
        var result = evm.find(em, ConnectionReference.class, id);
        return Optional.ofNullable(result);
    }
}
