/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views;

import java.util.Map;
import java.util.Set;

import jakarta.validation.constraints.NotEmpty;

import com.blazebit.persistence.view.MappingSingular;

import io.debezium.platform.domain.views.base.NamedView;
import io.debezium.platform.domain.views.refs.VaultReference;

public interface PipelineComponent extends NamedView {
    String getDescription();

    @NotEmpty
    String getType();

    @NotEmpty
    String getSchema();

    Set<VaultReference> getVaults();

    @MappingSingular
    Map<String, Object> getConfig();

    void setDescription(String description);

    void setType(String type);

    void setName(String name);

    void setSchema(String schema);

    void setVaults(Set<VaultReference> vaults);

    void setConfig(Map<String, Object> config);
}
