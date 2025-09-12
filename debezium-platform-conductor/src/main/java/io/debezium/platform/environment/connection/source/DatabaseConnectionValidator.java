/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import java.sql.SQLException;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.jdbc.JdbcConnection;
import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionValidator;
import io.debezium.platform.environment.database.DatabaseConnectionConfiguration;
import io.debezium.platform.environment.database.DatabaseConnectionFactory;
import io.debezium.platform.error.ErrorCodes;

@ApplicationScoped
@Named("DATABASE")
public class DatabaseConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(DatabaseConnectionValidator.class);

    private final int databaseConnectionValidationTimeout;
    private final DatabaseConnectionFactory databaseConnectionFactory;

    public DatabaseConnectionValidator(
                                       DatabaseConnectionFactory databaseConnectionFactory,
                                       @ConfigProperty(name = "sources.database.connection.timeout") int databaseConnectionValidationTimeout) {
        this.databaseConnectionValidationTimeout = databaseConnectionValidationTimeout;
        this.databaseConnectionFactory = databaseConnectionFactory;
    }

    @Override
    public ConnectionValidationResult validate(Connection config) {

        DatabaseConnectionConfiguration databaseConnectionConfiguration = DatabaseConnectionConfiguration.from(config);
        try (JdbcConnection jdbcConnection = databaseConnectionFactory.create(databaseConnectionConfiguration)) {

            return new ConnectionValidationResult(jdbcConnection.connection().isValid(databaseConnectionValidationTimeout));

        }
        catch (SQLException sqlException) {
            LOGGER.error("Unable to verify connection to {} at host {}", config.getType(), databaseConnectionConfiguration.hostname(), sqlException);
            // Here we just put a generic CONNECTION_ERROR to avoid to map every possible database specific error.
            return new ConnectionValidationResult(false, sqlException.getMessage(), ErrorCodes.CONNECTION_ERROR.name());
        }
        catch (Exception e) {
            LOGGER.error("Unable to verify connection to {} at host {}", config.getType(), databaseConnectionConfiguration.hostname(), e);
            return new ConnectionValidationResult(false, "Generic error", ErrorCodes.GENERIC_ERROR.name());
        }
    }
}
