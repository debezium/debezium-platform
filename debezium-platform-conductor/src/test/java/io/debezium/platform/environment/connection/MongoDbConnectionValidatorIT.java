/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import jakarta.inject.Inject;

import org.junit.jupiter.api.Test;
import org.testcontainers.mongodb.MongoDBContainer;

import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.environment.connection.source.MongoDbConnectionValidator;
import io.debezium.platform.environment.database.db.MongoDbTestResource;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(value = MongoDbTestResource.class, restrictToAnnotatedClass = true)
public class MongoDbConnectionValidatorIT {

    @Inject
    MongoDbConnectionValidator connectionValidator;

    @Test
    void isValidConnection() {
        MongoDBContainer container = MongoDbTestResource.getMongoDBContainer();

        var connectionConfig = new TestConnectionView(ConnectionEntity.Type.MONGODB, Map.of(
                MongoDbConnectionValidator.MONGODB_CONNECTION_STRING, container.getReplicaSetUrl()));

        assertThat(connectionValidator.validate(connectionConfig).valid()).isTrue();
    }

    @Test
    void isNotValidConnection() {
        var connectionConfig = new TestConnectionView(ConnectionEntity.Type.MONGODB, Map.of(
                MongoDbConnectionValidator.MONGODB_CONNECTION_STRING, "mongodb://localhost:1"));

        var result = connectionValidator.validate(connectionConfig);

        assertThat(result.valid()).isFalse();
        assertThat(result.errorType()).isEqualTo("CONNECTION_ERROR");
    }

    @Test
    void missingConnectionStringThrowsException() {
        var connectionConfig = new TestConnectionView(ConnectionEntity.Type.MONGODB, Map.of());

        assertThatThrownBy(() -> connectionValidator.validate(connectionConfig))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("MongoDB connection string is required");
    }

    @Test
    void blankConnectionStringThrowsException() {
        var connectionConfig = new TestConnectionView(ConnectionEntity.Type.MONGODB, Map.of(
                MongoDbConnectionValidator.MONGODB_CONNECTION_STRING, " "));

        assertThatThrownBy(() -> connectionValidator.validate(connectionConfig))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("MongoDB connection string is required");
    }
}
