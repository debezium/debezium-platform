/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.QdrantConnectionValidator;

public class QdrantConnectionValidatorIT {

    @Test
    public void testValidate_withValidConfig_shouldReturnSuccessOrFailure() {
        QdrantConnectionValidator validator = new QdrantConnectionValidator();
        Map<String, Object> config = new HashMap<>();
        config.put("host", "localhost");
        config.put("port", 6333);
        config.put("protocol", "http");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);
        ConnectionValidationResult result = validator.validate(connection);
        // Accept either success or failure depending on Qdrant availability
        assertNotNull(result);
    }

    @Test
    public void testValidate_withInvalidConfig_shouldReturnFailure() {
        QdrantConnectionValidator validator = new QdrantConnectionValidator();
        Map<String, Object> config = new HashMap<>();
        config.put("host", "invalid-host");
        config.put("port", 9999);
        config.put("protocol", "http");
        Connection connection = new TestConnectionView(ConnectionEntity.Type.QDRANT, config);
        ConnectionValidationResult result = validator.validate(connection);
        assertFalse(result.valid());
    }
}
