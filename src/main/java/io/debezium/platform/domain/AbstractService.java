package io.debezium.platform.domain;

import com.blazebit.persistence.CriteriaBuilder;
import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;
import com.blazebit.persistence.view.EntityViewSetting;
import io.debezium.platform.domain.views.base.IdView;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;

import java.util.List;
import java.util.Optional;

import static jakarta.transaction.Transactional.TxType.REQUIRED;
import static jakarta.transaction.Transactional.TxType.SUPPORTS;

/**
 * Service ancestor
 *
 * @param <E> EntityType
 * @param <T> Updatable View Type
 * @param <R> Reference View Type
 */
@Transactional(REQUIRED)
public class AbstractService<E, T extends IdView, R extends IdView> {

    EntityManager em;
    CriteriaBuilderFactory cbf;
    EntityViewManager evm;
    Class<E> entityType;
    Class<T> viewType;
    Class<R> referenceViewType;

    public AbstractService(
            Class<E> entityType,
            Class<T> viewType,
            Class<R> referenceViewType,
            EntityManager em,
            CriteriaBuilderFactory cbf,
            EntityViewManager evm) {
        this.entityType = entityType;
        this.viewType = viewType;
        this.referenceViewType = referenceViewType;
        this.em = em;
        this.cbf = cbf;
        this.evm = evm;
    }

    public AbstractService() {
        // required by CDI
    }

    protected CriteriaBuilder<E> cb() {
        return cbf.create(em, entityType);
    }

    @Transactional(SUPPORTS)
    public <V> V viewAs(T view, Class<V> newViewType) {
        return evm.convert(view, newViewType);
    }

    @Transactional(SUPPORTS)
    public List<T> list() {
        return evm.applySetting(EntityViewSetting.create(viewType), cb())
                .getResultList();
    }

    @Transactional(SUPPORTS)
    public Optional<T> findById(Long id) {
        return findByIdAs(viewType, id);
    }

    @Transactional(SUPPORTS)
    public <V> Optional<V> findByIdAs(Class<V> viewType, Long id) {
        var result = evm.find(em, viewType, id);
        return Optional.ofNullable(result);
    }

    public T create(@Valid T view) {
        evm.save(em, view);
        onChange(view);
        return view;
    }

    public T update(@Valid T view) {
        evm.save(em, view);
        onChange(view);
        return view;
    }

    public void delete(long id) {
        evm.remove(em, referenceViewType, id);
        onChange(id);
    }

    @Transactional(REQUIRED)
    public void onChange(T view) {
        // default no-op
    }

    @Transactional(REQUIRED)
    public void onChange(Long id) {
        // default no-op
    }
}
