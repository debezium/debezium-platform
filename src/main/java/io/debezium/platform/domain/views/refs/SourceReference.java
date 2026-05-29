package io.debezium.platform.domain.views.refs;

import com.blazebit.persistence.view.EntityView;
import io.debezium.platform.data.model.SourceEntity;
import io.debezium.platform.domain.views.base.NamedView;

@EntityView(SourceEntity.class)
public interface SourceReference extends NamedView {
}
