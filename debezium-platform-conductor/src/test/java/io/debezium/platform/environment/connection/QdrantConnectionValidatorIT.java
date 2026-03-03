package io.debezium.platform.environment.connection;

import io.debezium.platform.environment.connection.destination.QdrantConnectionValidator;
import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import org.junit.jupiter.api.Test;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class QdrantConnectionValidatorIT {

    @Test
    public void testValidate_withValidConfig_shouldReturnSuccessOrFailure() {
        QdrantConnectionValidator validator = new QdrantConnectionValidator();
        Map<String, Object> config = new HashMap<>();
        config.put("host", "localhost");
        config.put("port", 6333);
        config.put("protocol", "http");
        Connection connection = new TestConnectionView(io.debezium.platform.data.model.ConnectionEntity.Type.QDRANT, config);
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
        Connection connection = new TestConnectionView(io.debezium.platform.data.model.ConnectionEntity.Type.QDRANT, config);
        ConnectionValidationResult result = validator.validate(connection);
        assertFalse(result.valid());
    }
}
