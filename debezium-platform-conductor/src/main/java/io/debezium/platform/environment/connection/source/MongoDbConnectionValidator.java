/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.source;

import java.time.Duration;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.eclipse.microprofile.config.inject.ConfigProperty;
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
    public static final String MONGODB_CONNECTION_STRING = "connection.string";

    private final int connectionTimeoutSeconds;

    public MongoDbConnectionValidator(@ConfigProperty(name = "sources.database.connection.timeout") int connectionTimeoutSeconds) {
        this.connectionTimeoutSeconds = connectionTimeoutSeconds;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        Configuration mongoConfig = toMongoDbConfiguration(connectionConfig);

        String connString = mongoConfig.getString(MONGODB_CONNECTION_STRING);

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
        Object connectionString = connectionConfig.getConfig().get(MONGODB_CONNECTION_STRING);

        if (!(connectionString instanceof String value) || value.isBlank()) {
            throw new IllegalArgumentException("MongoDB connection string is required");
        }

        // Without these the driver falls back to its own defaults, and server selection alone blocks for
        // 30s before an unreachable host is reported as unreachable.
        long timeoutMs = Duration.ofSeconds(connectionTimeoutSeconds).toMillis();

        return Configuration.create()
                .with("mongodb.connection.string", value)
                .with("mongodb.connect.timeout.ms", timeoutMs)
                .with("mongodb.server.selection.timeout.ms", timeoutMs)
                .build();
    }
}
