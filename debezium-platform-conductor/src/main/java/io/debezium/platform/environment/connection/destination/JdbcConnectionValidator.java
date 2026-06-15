/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.environment.connection.ConnectionValidator;
import io.debezium.util.Strings;

@ApplicationScoped
@Named("JDBC")
public class JdbcConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(JdbcConnectionValidator.class);

    private static final String URL_KEY = "url";
    private static final String USERNAME_KEY = "username";
    private static final String PASSWORD_KEY = "password";

    private final int connectionTimeout;

    public JdbcConnectionValidator(
                                   @ConfigProperty(name = "destinations.jdbc.connection.timeout", defaultValue = "5") int connectionTimeout) {
        this.connectionTimeout = connectionTimeout;
    }

    @Override
    public ConnectionValidationResult validate(io.debezium.platform.domain.views.Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        Map<String, Object> config = connectionConfig.getConfig();
        if (config == null) {
            return ConnectionValidationResult.failed("Connection configuration map cannot be null");
        }

        String url = getStringConfig(config, URL_KEY);
        if (Strings.isNullOrBlank(url)) {
            return ConnectionValidationResult.failed("JDBC URL must be specified");
        }

        String username = getStringConfig(config, USERNAME_KEY);
        String password = getStringConfig(config, PASSWORD_KEY);

        LOGGER.debug("Validating JDBC connection to {}", url);

        DriverManager.setLoginTimeout(connectionTimeout);
        try (Connection connection = DriverManager.getConnection(url, username, password)) {
            boolean valid = connection.isValid(connectionTimeout);
            if (valid) {
                return ConnectionValidationResult.successful();
            }
            return ConnectionValidationResult.failed("JDBC connection is not valid");
        }
        catch (SQLException e) {
            LOGGER.warn("Failed to connect to JDBC destination: {}", e.getMessage());
            return ConnectionValidationResult.failed("Failed to connect: " + e.getMessage());
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during JDBC connection validation", e);
            return ConnectionValidationResult.failed("Unexpected error: " + e.getMessage());
        }
    }

    private String getStringConfig(Map<String, Object> config, String key) {
        Object value = config.get(key);
        return value != null ? value.toString() : null;
    }
}
