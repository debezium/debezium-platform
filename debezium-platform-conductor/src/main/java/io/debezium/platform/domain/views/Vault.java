/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.util.Map;

import com.blazebit.persistence.view.CreatableEntityView;
import com.blazebit.persistence.view.EntityView;
import com.blazebit.persistence.view.MappingSingular;
import com.blazebit.persistence.view.UpdatableEntityView;

import io.debezium.platform.data.model.VaultEntity;
import io.debezium.platform.domain.views.refs.VaultReference;

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
