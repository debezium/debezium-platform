package io.debezium.platform.domain.views.refs;

import com.blazebit.persistence.view.EntityView;
import io.debezium.platform.data.model.VaultEntity;
import io.debezium.platform.domain.views.base.NamedView;

@EntityView(VaultEntity.class)
public interface VaultReference extends NamedView {
}
