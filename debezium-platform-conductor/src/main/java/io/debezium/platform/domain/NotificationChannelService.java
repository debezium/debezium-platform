/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain;

import static io.debezium.platform.environment.notifications.Notifier.CONFIG_RECIPIENTS;
import static io.debezium.platform.environment.notifications.Notifier.CONFIG_URL;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.ws.rs.BadRequestException;

import com.blazebit.persistence.CriteriaBuilderFactory;
import com.blazebit.persistence.view.EntityViewManager;

import io.debezium.platform.api.dto.TestNotificationResponse;
import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.NotificationChannelEntity;
import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.Severity;
import io.debezium.platform.domain.views.NotificationChannel;
import io.debezium.platform.domain.views.refs.NotificationChannelReference;
import io.debezium.platform.environment.notifications.AlertNotification;
import io.debezium.platform.environment.notifications.NotificationResult;
import io.debezium.platform.environment.notifications.Notifier;
import io.debezium.platform.error.NotFoundException;

@ApplicationScoped
public class NotificationChannelService extends AbstractService<NotificationChannelEntity, NotificationChannel, NotificationChannelReference> {

    private final Instance<Notifier> notifiers;

    public NotificationChannelService(EntityManager em, CriteriaBuilderFactory cbf, EntityViewManager evm,
                                      Instance<Notifier> notifiers) {
        super(NotificationChannelEntity.class, NotificationChannel.class, NotificationChannelReference.class, em, cbf, evm);
        this.notifiers = notifiers;
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
        NotificationChannel channel = findById(id).orElseThrow(() -> new NotFoundException(id));

        NotificationChannelEntity entity = em.find(NotificationChannelEntity.class, id);
        Notifier notifier = notifiers.stream()
                .filter(n -> n.type() == channel.getType())
                .findFirst()
                .orElse(null);

        if (notifier == null) {
            return new TestNotificationResponse(false, "No notifier implementation for type '" + channel.getType() + "'");
        }

        AlertNotification testNotification = new AlertNotification(
                "test-rule",
                "test-pipeline",
                "Test Pipeline",
                AlertStateValue.FIRING,
                Severity.INFO,
                42.0,
                50.0,
                Operator.GREATER_THAN,
                "This is a test notification from Debezium Platform",
                Instant.now(),
                null);

        NotificationResult result = notifier.send(testNotification, entity);
        return new TestNotificationResponse(result.success(), result.message());
    }

    @SuppressWarnings("unchecked")
    private void validateConfig(ChannelType type, Map<String, Object> config) {
        if (config == null) {
            throw new BadRequestException("Config is required");
        }
        switch (type) {
            case EMAIL -> {
                Object recipients = config.get(CONFIG_RECIPIENTS);
                if (recipients == null) {
                    throw new BadRequestException("Email channel requires '" + CONFIG_RECIPIENTS + "' in config");
                }
                if (recipients instanceof List<?> list && list.isEmpty()) {
                    throw new BadRequestException("Email channel requires at least one recipient");
                }
            }
            case WEBHOOK -> {
                Object url = config.get(CONFIG_URL);
                if (url == null || url.toString().isBlank()) {
                    throw new BadRequestException("Webhook channel requires '" + CONFIG_URL + "' in config");
                }
            }
        }
    }
}
