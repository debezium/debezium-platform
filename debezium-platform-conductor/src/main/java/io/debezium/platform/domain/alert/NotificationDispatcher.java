/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.TransactionPhase;
import jakarta.enterprise.inject.Instance;

import org.jboss.logging.Logger;

import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.NotificationChannelEntity;
import io.debezium.platform.environment.notifications.NotificationResult;
import io.debezium.platform.environment.notifications.Notifier;
import io.vertx.core.Vertx;

@ApplicationScoped
public class NotificationDispatcher {

    private static final Logger LOGGER = Logger.getLogger(NotificationDispatcher.class);
    private static final String STATE_FIRED = "FIRED";
    private static final String STATE_RESOLVED = "RESOLVED";

    private final Instance<Notifier> notifiers;
    private final Vertx vertx;

    public NotificationDispatcher(Instance<Notifier> notifiers, Vertx vertx) {
        this.notifiers = notifiers;
        this.vertx = vertx;
    }

    /**
     * Delivers the notification after the alert transition has committed, offloaded to a worker thread
     * so a slow or unresponsive endpoint (webhook retries can block for tens of seconds) cannot block
     * the transaction-completion / alert evaluation thread.
     */
    void onNotificationReady(@Observes(during = TransactionPhase.AFTER_SUCCESS) AlertNotificationReady ready) {
        if (ready.channels().isEmpty()) {
            return;
        }
        String state = ready.notification().resolvedAt() == null ? STATE_FIRED : STATE_RESOLVED;
        LOGGER.infov("Alert {0} for rule ''{1}'' on pipeline ''{2}'' (severity={3})",
                state, ready.notification().ruleName(), ready.notification().pipelineId(),
                ready.notification().severity());

        vertx.executeBlocking(() -> {
            deliver(ready);
            return null;
        }, false);
    }

    void deliver(AlertNotificationReady ready) {
        for (NotificationChannelEntity channel : ready.channels()) {
            if (!channel.isEnabled()) {
                continue;
            }
            Notifier notifier = findNotifier(channel.getType());
            if (notifier == null) {
                LOGGER.warnv("No notifier implementation for channel type ''{0}''", channel.getType());
                continue;
            }
            try {
                NotificationResult result = notifier.send(ready.notification(), channel);
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
}
