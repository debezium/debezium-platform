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

import io.debezium.platform.data.model.TransformEntity;
import io.debezium.platform.domain.views.Transform;
import io.debezium.platform.domain.views.refs.TransformReference;

@ApplicationScoped
public class TransformService extends AbstractService<TransformEntity, Transform, TransformReference> {

    public TransformService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm) {
        super(TransformEntity.class, Transform.class, TransformReference.class, em, cbf, evm);
    }

    @Transactional(SUPPORTS)
    public Optional<TransformReference> findReferenceById(Long id) {
        var result = evm.find(em, TransformReference.class, id);
        return Optional.ofNullable(result);
    }
}
