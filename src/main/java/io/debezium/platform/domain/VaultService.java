package io.debezium.platform.domain;


import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.debezium.outbox.quarkus.ExportedEvent;
import io.debezium.platform.data.model.VaultEntity;
import io.debezium.platform.domain.views.Vault;
import io.debezium.platform.domain.views.refs.VaultReference;
import io.debezium.platform.environment.watcher.events.VaultEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;


@ApplicationScoped
public class VaultService extends AbstractService<VaultEntity, Vault, VaultReference> {

    @Inject
    Event<ExportedEvent<?, ?>> event;

    @Inject
    ObjectMapper objectMapper;

    public VaultService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm) {
        super(VaultEntity.class, Vault.class, VaultReference.class, em, cbf, evm);
    }

    @Override
    @Transactional(Transactional.TxType.REQUIRED)
    public void onChange(Vault view) {
        event.fire(VaultEvent.update(view, objectMapper));
    }

    @Override
    @Transactional(Transactional.TxType.REQUIRED)
    public void onChange(Long id) {
        event.fire(VaultEvent.delete(id));
    }
}
