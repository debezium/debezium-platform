/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import jakarta.inject.Named;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;

@Named("DATABASE")
@ApplicationScoped
@Alternative
public class TestDatabaseConnectionValidator implements ConnectionValidator {

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        return new ConnectionValidationResult(true);
    }

}
