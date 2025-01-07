/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.views.base;

import jakarta.validation.constraints.NotEmpty;

public interface NamedView extends IdView {
    @NotEmpty
    String getName();
}
