/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.data.model.ConnectionEntity;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.destination.RocketMqConnectionValidator;

/**
 * Unit tests for {@link RocketMqConnectionValidator}.
 *
 * <p>These tests cover the parameter validation and error handling performed before any
 * network interaction takes place, so they do not require Docker or a running RocketMQ
 * name server. Connectivity itself is covered by {@code RocketMqConnectionValidatorIT}.</p>
 */
class RocketMqConnectionValidatorTest {

    private static final int DEFAULT_TIMEOUT_SECONDS = 5;

    private RocketMqConnectionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new RocketMqConnectionValidator(DEFAULT_TIMEOUT_SECONDS);
    }

    @Test
    @DisplayName("Should fail validation when the connection is null")
    void shouldFailWhenConnectionIsNull() {
        ConnectionValidationResult result = validator.validate(null);

        assertThat(result.valid()).isFalse();
        assertThat(result.message()).isEqualTo("Connection configuration cannot be null");
    }

    @Test
    @DisplayName("Should fail validation when name server address is missing")
    void shouldFailWhenNameServerAddressMissing() {
        ConnectionValidationResult result = validator.validate(connectionWith(new HashMap<>()));

        assertThat(result.valid()).isFalse();
        assertThat(result.message()).isEqualTo("Name server address must be specified");
    }

    @Test
    @DisplayName("Should fail validation when name server address is blank")
    void shouldFailWhenNameServerAddressIsBlank() {
        Map<String, Object> config = new HashMap<>();
        config.put("producer.name.srv.addr", "   ");

        ConnectionValidationResult result = validator.validate(connectionWith(config));

        assertThat(result.valid()).isFalse();
        assertThat(result.message()).isEqualTo("Name server address must be specified");
    }

    @Test
    @DisplayName("Should fail validation when ACL is enabled without credentials")
    void shouldFailWhenAclEnabledWithoutCredentials() {
        Map<String, Object> config = new HashMap<>();
        config.put("producer.name.srv.addr", "localhost:9876");
        config.put("producer.acl.enabled", true);

        ConnectionValidationResult result = validator.validate(connectionWith(config));

        assertThat(result.valid()).isFalse();
        assertThat(result.message()).isEqualTo("Access key and secret key must be specified when ACL is enabled");
    }

    @Test
    @DisplayName("Should fail validation when ACL is enabled with only an access key")
    void shouldFailWhenAclEnabledWithoutSecretKey() {
        Map<String, Object> config = new HashMap<>();
        config.put("producer.name.srv.addr", "localhost:9876");
        config.put("producer.acl.enabled", "true");
        config.put("producer.access.key", "accessKey");

        ConnectionValidationResult result = validator.validate(connectionWith(config));

        assertThat(result.valid()).isFalse();
        assertThat(result.message()).isEqualTo("Access key and secret key must be specified when ACL is enabled");
    }

    @Test
    @DisplayName("Should fail validation when the name server is unreachable")
    void shouldFailWhenNameServerIsUnreachable() {
        Map<String, Object> config = new HashMap<>();
        config.put("producer.name.srv.addr", "10.255.255.1:9876");

        ConnectionValidationResult result = validator.validate(connectionWith(config));

        assertThat(result.valid()).isFalse();
        assertThat(result.message()).startsWith("Failed to connect to RocketMQ name server at 10.255.255.1:9876");
    }

    private Connection connectionWith(Map<String, Object> config) {
        return new TestConnectionView(ConnectionEntity.Type.APACHE_ROCKETMQ, config);
    }
}
