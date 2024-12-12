package io.debezium.platform.domain.views.refs;

import com.blazebit.persistence.view.EntityView;
import io.debezium.platform.data.model.DestinationEntity;
import io.debezium.platform.data.model.PipelineEntity;
import io.debezium.platform.domain.views.base.NamedView;

@EntityView(PipelineEntity.class)
public interface PipelineReference extends NamedView {
}
