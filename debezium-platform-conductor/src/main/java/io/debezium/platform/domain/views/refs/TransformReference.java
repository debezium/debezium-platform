package io.debezium.platform.domain.views.refs;

import com.blazebit.persistence.view.EntityView;
import io.debezium.platform.data.model.TransformEntity;
import io.debezium.platform.domain.views.base.NamedView;

@EntityView(TransformEntity.class)
public interface TransformReference extends NamedView {
}
