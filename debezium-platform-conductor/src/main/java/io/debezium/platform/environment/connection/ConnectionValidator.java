/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;

public interface ConnectionValidator {

    ConnectionValidationResult validate(Connection connectionConfig);
}
