/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.config;

import jakarta.enterprise.inject.Produces;
import jakarta.inject.Singleton;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

/**
 * Provides a Jackson 2 {@link ObjectMapper}.
 * <p>
 * Quarkus 4 only provides a Jackson 3 mapper ({@code tools.jackson.databind.ObjectMapper}), but the
 * Debezium outbox extension and the Blaze-Persistence Jackson integration still require Jackson 2.
 * This mapper is used for those paths and mirrors the Quarkus 3 defaults.
 */
public class Jackson2ObjectMapperProducer {

    @Produces
    @Singleton
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .findAndRegisterModules()
                .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
}
