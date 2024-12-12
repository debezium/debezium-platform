package io.debezium.platform.domain.views;

import com.blazebit.persistence.view.CreatableEntityView;
import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.UpdatableEntityView;
import io.debezium.platform.data.model.SourceEntity;


@EntityView(SourceEntity.class)
@CreatableEntityView
@UpdatableEntityView
public interface Source extends PipelineComponent {
}
