package io.debezium.platform.domain.views;

import com.blazebit.persistence.view.CreatableEntityView;
import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.UpdatableEntityView;
import io.debezium.platform.data.model.DestinationEntity;

@EntityView(DestinationEntity.class)
@CreatableEntityView
@UpdatableEntityView
public interface Destination extends PipelineComponent {
}
