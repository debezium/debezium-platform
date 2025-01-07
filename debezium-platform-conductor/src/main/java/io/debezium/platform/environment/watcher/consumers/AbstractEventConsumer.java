/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.watcher.consumers;

import org.jboss.logging.Logger;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.debezium.platform.environment.EnvironmentController;

public abstract class AbstractEventConsumer<T> implements EnvironmentEventConsumer<T> {

    protected final Logger logger;
    protected final EnvironmentController environment;
    protected final ObjectMapper objectMapper;
    protected final Class<T> payloadType;

    public AbstractEventConsumer(Logger logger, EnvironmentController environment, ObjectMapper objectMapper, Class<T> payloadType) {
        this.logger = logger;
        this.environment = environment;
        this.objectMapper = objectMapper;
        this.payloadType = payloadType;
    }

    @Override
    public Class<T> consumedPayloadType() {
        return payloadType;
    }

    @Override
    public T convert(String payload) {
        if (payload == null) {
            return null;
        }
        try {
            return objectMapper.readValue(payload, consumedPayloadType());
        }
        catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }
}
