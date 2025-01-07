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

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.data.model.DestinationEntity;
import io.debezium.platform.domain.views.Destination;
import io.debezium.platform.domain.views.refs.DestinationReference;

@ApplicationScoped
public class DestinationService extends AbstractService<DestinationEntity, Destination, DestinationReference> {

    public DestinationService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm) {
        super(DestinationEntity.class, Destination.class, DestinationReference.class, em, cbf, evm);
    }

    @Transactional(SUPPORTS)
    public Optional<DestinationReference> findReferenceById(Long id) {
        var result = evm.find(em, DestinationReference.class, id);
        return Optional.ofNullable(result);
    }
}
