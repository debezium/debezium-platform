package io.debezium.platform.domain.views.flat;

import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.UpdatableEntityView;
import io.debezium.platform.data.model.PipelineEntity;
import io.debezium.platform.domain.views.Destination;
import io.debezium.platform.domain.views.Source;
import io.debezium.platform.domain.views.Transform;
import io.debezium.platform.domain.views.base.NamedView;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

@EntityView(PipelineEntity.class)
@UpdatableEntityView
public interface PipelineFlat extends NamedView {
    String getDescription();
    @NotNull
    Source getSource();
    @NotNull
    Destination getDestination();
    List<Transform> getTransforms();
    @NotEmpty
    String getLogLevel();

    void setDescription(String description);
    void setName(String name);
    void setSource(Source source);
    void setDestination(Destination destination);
    void setLogLevel(String logLevel);
    void setTransforms(List<Transform> transforms);
}
