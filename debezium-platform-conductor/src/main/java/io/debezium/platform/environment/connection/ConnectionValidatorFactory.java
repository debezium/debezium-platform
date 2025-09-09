/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.enterprise.inject.literal.NamedLiteral;

@ApplicationScoped
public class ConnectionValidatorFactory {

    private final Instance<ConnectionValidator> validators;

    public ConnectionValidatorFactory(Instance<ConnectionValidator> validators) {
        this.validators = validators;
    }

    public ConnectionValidator getValidator(String connectionType) {
        String validatorName = mapToValidatorName(connectionType);
        return validators
                .select(NamedLiteral.of(validatorName))
                .get();
    }

    private String mapToValidatorName(String connectionType) {
        return switch (connectionType) {
            case "ORACLE", "MYSQL", "MARIADB", "SQLSERVER", "POSTGRESQL" -> "DATABASE";
            default -> connectionType;
        };
    }
}
