package io.debezium.platform.domain;


import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;
import com.blazebit.persistence.view.EntityViewSetting;
import io.debezium.platform.data.model.SourceEntity;
import io.debezium.platform.domain.views.Source;
import io.debezium.platform.domain.views.Vault;
import io.debezium.platform.domain.views.refs.SourceReference;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;

import java.util.List;
import java.util.Optional;

import static jakarta.transaction.Transactional.TxType.REQUIRED;
import static jakarta.transaction.Transactional.TxType.SUPPORTS;

@ApplicationScoped
public class SourceService extends AbstractService<SourceEntity, Source, SourceReference> {

    public SourceService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm) {
        super(SourceEntity.class, Source.class, SourceReference.class, em, cbf, evm);
    }

    @Transactional(SUPPORTS)
    public Optional<SourceReference> findReferenceById(Long id) {
        var result = evm.find(em, SourceReference.class, id);
        return Optional.ofNullable(result);
    }
}
