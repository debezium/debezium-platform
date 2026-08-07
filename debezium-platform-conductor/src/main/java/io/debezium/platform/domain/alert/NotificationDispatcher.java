/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;

import org.jboss.logging.Logger;

import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.NotificationChannelEntity;
import io.debezium.platform.environment.notifications.AlertNotification;
import io.debezium.platform.environment.notifications.NotificationResult;
import io.debezium.platform.environment.notifications.Notifier;

@ApplicationScoped
public class NotificationDispatcher {

    private static final Logger LOGGER = Logger.getLogger(NotificationDispatcher.class);
    private static final String STATE_FIRED = "FIRED";
    private static final String STATE_RESOLVED = "RESOLVED";

    private final Instance<Notifier> notifiers;

    public NotificationDispatcher(Instance<Notifier> notifiers) {
        this.notifiers = notifiers;
    }

    public void dispatch(AlertRuleEntity rule, AlertEventEntity event) {
        String state = event.getResolvedAt() == null ? STATE_FIRED : STATE_RESOLVED;
        LOGGER.infov("Alert {0} for rule ''{1}'' on pipeline ''{2}'' (severity={3})",
                state, rule.getName(), event.getPipelineId(), event.getSeverity());

        AlertNotification notification = toNotification(rule, event);

        for (NotificationChannelEntity channel : rule.getChannels()) {
            if (!channel.isEnabled()) {
                continue;
            }
            Notifier notifier = findNotifier(channel.getType());
            if (notifier == null) {
                LOGGER.warnv("No notifier implementation for channel type ''{0}''", channel.getType());
                continue;
            }
            try {
                NotificationResult result = notifier.send(notification, channel);
                if (!result.success()) {
                    LOGGER.warnv("Notification failed for channel ''{0}'': {1}", channel.getName(), result.message());
                }
            }
            catch (Exception e) {
                LOGGER.errorv(e, "Error dispatching to channel ''{0}''", channel.getName());
            }
        }
    }

    private Notifier findNotifier(ChannelType type) {
        return notifiers.stream()
                .filter(n -> n.type() == type)
                .findFirst()
                .orElse(null);
    }

    private AlertNotification toNotification(AlertRuleEntity rule, AlertEventEntity event) {
        AlertStateValue state = event.getResolvedAt() == null ? AlertStateValue.FIRING : AlertStateValue.OK;
        return new AlertNotification(
                rule.getName(),
                event.getPipelineId(),
                event.getPipelineName(),
                state,
                event.getSeverity(),
                event.getValue(),
                event.getThreshold(),
                rule.getOperator(),
                event.getMessage(),
                event.getFiredAt(),
                event.getResolvedAt());
    }
}
