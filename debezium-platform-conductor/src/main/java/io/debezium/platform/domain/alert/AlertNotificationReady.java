/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import java.util.List;

import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.NotificationChannelEntity;
import io.debezium.platform.environment.notifications.AlertNotification;

/**
 * Domain event published once an alert transition (fire or resolve) has been persisted and its
 * notification is ready to be delivered.
 *
 * <p>Delivery observes this event with {@code @Observes(during = TransactionPhase.AFTER_SUCCESS)} so
 * that notifications are sent only after the state write has committed: a failing delivery cannot
 * roll the transition back, and no phantom notification is sent for a transition that never
 * committed. The event carries a fully detached snapshot ({@code notification} plus the target
 * {@code channels}) built while the persistence context was still open, so delivery can run on a
 * worker thread without touching lazy JPA associations.</p>
 *
 * @param notification the detached notification payload
 * @param channels     the target channels captured at transition time (may include disabled ones)
 */
public record AlertNotificationReady(AlertNotification notification, List<NotificationChannelEntity> channels) {

    /**
     * Builds a detached snapshot from the persisted rule and event. Must be called within the
     * transaction that persisted the transition so the lazy {@code channels} association is
     * initialized before the persistence context closes.
     */
    public static AlertNotificationReady from(AlertRuleEntity rule, AlertEventEntity event) {
        AlertStateValue state = event.getResolvedAt() == null ? AlertStateValue.FIRING : AlertStateValue.OK;
        AlertNotification notification = new AlertNotification(
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
        return new AlertNotificationReady(notification, List.copyOf(rule.getChannels()));
    }
}
