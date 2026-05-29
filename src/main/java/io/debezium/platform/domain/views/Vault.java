package io.debezium.platform.domain.views;

import com.blazebit.persistence.view.CreatableEntityView;
import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.MappingSingular;
import com.blazebit.persistence.view.UpdatableEntityView;
import io.debezium.platform.data.model.VaultEntity;
import io.debezium.platform.domain.views.refs.VaultReference;

import java.util.Map;

@EntityView(VaultEntity.class)
@CreatableEntityView
@UpdatableEntityView
public interface Vault extends VaultReference {
    boolean isPlaintext();
    @MappingSingular
    Map<String, String> getItems();

    void setName(String name);
    void setPlaintext(boolean plaintext);
    void setItems(Map<String, String> items);
}
