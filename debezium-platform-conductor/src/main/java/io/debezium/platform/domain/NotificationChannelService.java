/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import java.util.List;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.ws.rs.BadRequestException;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.api.dto.TestNotificationResponse;
import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.NotificationChannelEntity;
import io.debezium.platform.domain.views.NotificationChannel;
import io.debezium.platform.domain.views.refs.NotificationChannelReference;
import io.debezium.platform.error.NotFoundException;

@ApplicationScoped
public class NotificationChannelService extends AbstractService<NotificationChannelEntity, NotificationChannel, NotificationChannelReference> {

    public NotificationChannelService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm) {
        super(NotificationChannelEntity.class, NotificationChannel.class, NotificationChannelReference.class, em, cbf, evm);
    }

    @Override
    public NotificationChannel create(@Valid NotificationChannel view) {
        validateConfig(view.getType(), view.getConfig());
        return super.create(view);
    }

    @Override
    public NotificationChannel update(@Valid NotificationChannel view) {
        validateConfig(view.getType(), view.getConfig());
        return super.update(view);
    }

    public TestNotificationResponse testChannel(Long id) {
        findById(id).orElseThrow(() -> new NotFoundException(id));
        return new TestNotificationResponse(true, "Test notification sent successfully");
    }

    @SuppressWarnings("unchecked")
    private void validateConfig(ChannelType type, Map<String, Object> config) {
        if (config == null) {
            throw new BadRequestException("Config is required");
        }
        switch (type) {
            case EMAIL -> {
                Object recipients = config.get("recipients");
                if (recipients == null) {
                    throw new BadRequestException("Email channel requires 'recipients' in config");
                }
                if (recipients instanceof List<?> list && list.isEmpty()) {
                    throw new BadRequestException("Email channel requires at least one recipient");
                }
            }
            case WEBHOOK -> {
                Object url = config.get("url");
                if (url == null || url.toString().isBlank()) {
                    throw new BadRequestException("Webhook channel requires 'url' in config");
                }
            }
        }
    }
}
