package io.debezium.platform.domain.views.refs;

import com.blazebit.persistence.view.EntityView;
import io.debezium.platform.data.model.DestinationEntity;
import io.debezium.platform.domain.views.base.NamedView;

@EntityView(DestinationEntity.class)
public interface DestinationReference extends NamedView {
}
