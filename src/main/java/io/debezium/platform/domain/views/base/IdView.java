package io.debezium.platform.domain.views.base;

import com.blazebit.persistence.view.IdMapping;

public interface IdView {
    @IdMapping
    Long getId();
}
