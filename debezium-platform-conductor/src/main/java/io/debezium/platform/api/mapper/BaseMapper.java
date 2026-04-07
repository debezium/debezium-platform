package io.debezium.platform.api.mapper;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.inject.Inject;

import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.api.dto.NamedRef;

public abstract class BaseMapper {
    @Inject
    EntityViewManager evm;

    protected <T> T toViewRef(Class<T> refType, NamedRef ref) {
        return ref != null ? evm.getReference(refType, ref.id()) : null;
    }

    protected <T> Set<T> toViewRefSet(Class<T> refType, Set<NamedRef> refs) {
        if (refs == null)
            return null;
        return refs.stream().map(r -> toViewRef(refType, r)).collect(Collectors.toSet());
    }

    protected <T> List<T> toViewRefList(Class<T> refType, List<NamedRef> refs) {
        if (refs == null)
            return null;
        return refs.stream().map(r -> toViewRef(refType, r)).toList();
    }
}
