/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.QdrantConnectionValidator;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;

@QuarkusTest
@QuarkusTestResource(QdrantTestResource.class)
public class QdrantConnectionValidatorIT {

    private QdrantConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new QdrantConnectionValidator(60);
    }

    @Test
    public void testValidate_withValidConfig_shouldReturnSuccess() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", QdrantTestResource.getHost());
        config.put("port", QdrantTestResource.getPort());
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);
        ConnectionValidationResult result = validator.validate(connection);
        assertTrue(result.valid());
    }

    @Test
    public void testValidate_withInvalidConfig_shouldReturnFailure() {
        Map<String, Object> config = new HashMap<>();
        config.put("host", "invalid-host");
        config.put("port", 9999);
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);
        ConnectionValidationResult result = validator.validate(connection);
        assertFalse(result.valid());
    }
}
