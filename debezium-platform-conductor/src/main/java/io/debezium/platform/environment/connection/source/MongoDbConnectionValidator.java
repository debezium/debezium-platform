/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.config.Configuration;
import io.debezium.connector.mongodb.connection.MongoDbConnection;
import io.debezium.connector.mongodb.connection.MongoDbConnections;
import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionValidator;
import io.debezium.platform.error.ErrorCodes;

@ApplicationScoped
@Named("MONGODB")
public class MongoDbConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(MongoDbConnectionValidator.class);

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        Configuration mongoConfig = toMongoDbConfiguration(connectionConfig);

        String connString = mongoConfig.getString("mongodb.connection.string");

        try (MongoDbConnection connection = MongoDbConnections.create(mongoConfig)) {
            connection.hello();
            return new ConnectionValidationResult(true, "MongoDB connectivity validation succeeded.", "");
        }
        catch (Exception e) {
            LOGGER.error("Unable to verify connection to MongoDb at host {}", connString, e);
            return new ConnectionValidationResult(false, e.getMessage(), ErrorCodes.CONNECTION_ERROR.name());
        }
    }

    private Configuration toMongoDbConfiguration(Connection connectionConfig) {
        Object connectionString = connectionConfig.getConfig().get("mongodb.connection.string");

        if (!(connectionString instanceof String value) || value.isBlank()) {
            throw new IllegalArgumentException("MongoDB connection string is required");
        }

        return Configuration.create()
                .with("mongodb.connection.string", value)
                .build();
    }
}
