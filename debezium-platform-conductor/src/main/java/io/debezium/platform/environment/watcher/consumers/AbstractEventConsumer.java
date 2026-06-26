/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.watcher.consumers;

import jakarta.enterprise.inject.Instance;

import org.jboss.logging.Logger;

import com.blazebit.persistence.integration.jackson.EntityViewAwareObjectMapper;
import com.blazebit.persistence.view.EntityViewManager;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.debezium.platform.environment.EnvironmentController;

public abstract class AbstractEventConsumer<T> implements EnvironmentEventConsumer<T> {

    protected final Logger logger;
    protected final EnvironmentController environment;
    protected final ObjectMapper objectMapper;
    protected final EntityViewManager evm;
    protected final Class<T> payloadType;
    // This is required to correctly deserialize EntityView see: https://persistence.blazebit.com/documentation/1.6/entity-view/manual/en_US/#usage-5
    protected final EntityViewAwareObjectMapper mapper;

    public AbstractEventConsumer(Logger logger, Instance<EnvironmentController> environmentInstance, ObjectMapper objectMapper, EntityViewManager evm,
                                 Class<T> payloadType) {
        this.logger = logger;
        this.environment = environmentInstance.get();
        this.objectMapper = objectMapper;
        this.evm = evm;
        this.payloadType = payloadType;
        this.mapper = new EntityViewAwareObjectMapper(evm, objectMapper);
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
            return mapper.getObjectMapper().readValue(payload, consumedPayloadType());
        }
        catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }
}
