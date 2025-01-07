/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views.base;

import com.blazebit.persistence.view.IdMapping;

public interface IdView {
    @IdMapping
    Long getId();
}
