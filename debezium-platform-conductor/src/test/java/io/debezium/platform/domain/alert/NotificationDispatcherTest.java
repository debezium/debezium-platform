/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.stream.Stream;

import jakarta.enterprise.inject.Instance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.NotificationChannelEntity;
import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.Severity;
import io.debezium.platform.environment.notifications.AlertNotification;
import io.debezium.platform.environment.notifications.NotificationResult;
import io.debezium.platform.environment.notifications.Notifier;
import io.vertx.core.Vertx;

@ExtendWith(MockitoExtension.class)
class NotificationDispatcherTest {

    @Mock
    Instance<Notifier> notifiers;

    @Mock
    Notifier webhookNotifier;

    @Mock
    Notifier emailNotifier;

    @Mock
    Vertx vertx;

    NotificationDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new NotificationDispatcher(notifiers, vertx);
    }

    @Test
    void onNotificationReadyDeliversOffThread() {
        NotificationChannelEntity channel = createChannel("webhook-channel", ChannelType.WEBHOOK, true);

        dispatcher.onNotificationReady(ready(channel));

        verify(vertx).executeBlocking(any(Callable.class), eq(false));
    }

    @Test
    void onNotificationReadySkipsWhenNoChannels() {
        dispatcher.onNotificationReady(ready());

        verify(vertx, never()).executeBlocking(any(Callable.class), eq(false));
    }

    @Test
    void deliverSendsToMatchingNotifier() {
        NotificationChannelEntity channel = createChannel("webhook-channel", ChannelType.WEBHOOK, true);

        when(webhookNotifier.type()).thenReturn(ChannelType.WEBHOOK);
        when(notifiers.stream()).thenReturn(Stream.of(webhookNotifier));
        when(webhookNotifier.send(any(), any())).thenReturn(new NotificationResult(true, "OK"));

        dispatcher.deliver(ready(channel));

        verify(webhookNotifier).send(any(), any());
    }

    @Test
    void deliverSkipsDisabledChannels() {
        NotificationChannelEntity channel = createChannel("webhook-channel", ChannelType.WEBHOOK, false);

        dispatcher.deliver(ready(channel));

        verify(notifiers, never()).stream();
    }

    @Test
    void deliverHandlesMultipleChannels() {
        NotificationChannelEntity webhookChannel = createChannel("webhook-channel", ChannelType.WEBHOOK, true);
        NotificationChannelEntity emailChannel = createChannel("email-channel", ChannelType.EMAIL, true);

        when(webhookNotifier.type()).thenReturn(ChannelType.WEBHOOK);
        when(emailNotifier.type()).thenReturn(ChannelType.EMAIL);
        when(notifiers.stream()).thenReturn(Stream.of(webhookNotifier, emailNotifier))
                .thenReturn(Stream.of(webhookNotifier, emailNotifier));
        when(webhookNotifier.send(any(), any())).thenReturn(new NotificationResult(true, "OK"));
        when(emailNotifier.send(any(), any())).thenReturn(new NotificationResult(true, "OK"));

        dispatcher.deliver(ready(webhookChannel, emailChannel));

        verify(webhookNotifier).send(any(), any());
        verify(emailNotifier).send(any(), any());
    }

    @Test
    void deliverContinuesWhenNotifierThrows() {
        NotificationChannelEntity webhookChannel = createChannel("webhook-channel", ChannelType.WEBHOOK, true);
        NotificationChannelEntity emailChannel = createChannel("email-channel", ChannelType.EMAIL, true);

        when(webhookNotifier.type()).thenReturn(ChannelType.WEBHOOK);
        when(emailNotifier.type()).thenReturn(ChannelType.EMAIL);
        when(notifiers.stream()).thenReturn(Stream.of(webhookNotifier, emailNotifier))
                .thenReturn(Stream.of(webhookNotifier, emailNotifier));
        when(webhookNotifier.send(any(), any())).thenThrow(new RuntimeException("Connection refused"));
        when(emailNotifier.send(any(), any())).thenReturn(new NotificationResult(true, "OK"));

        dispatcher.deliver(ready(webhookChannel, emailChannel));

        verify(emailNotifier).send(any(), any());
    }

    @Test
    void deliverHandlesNoMatchingNotifier() {
        NotificationChannelEntity channel = createChannel("webhook-channel", ChannelType.WEBHOOK, true);

        when(notifiers.stream()).thenReturn(Stream.empty());

        dispatcher.deliver(ready(channel));
    }

    private AlertNotificationReady ready(NotificationChannelEntity... channels) {
        AlertNotification notification = new AlertNotification(
                "test-rule", "pipeline-1", null, AlertStateValue.FIRING, Severity.WARNING,
                150.0, 100.0, Operator.GREATER_THAN, "Alert fired",
                Instant.parse("2026-07-30T10:00:00Z"), null);
        return new AlertNotificationReady(notification, List.of(channels));
    }

    private NotificationChannelEntity createChannel(String name, ChannelType type, boolean enabled) {
        NotificationChannelEntity channel = new NotificationChannelEntity();
        channel.setId(1L);
        channel.setName(name);
        channel.setType(type);
        channel.setEnabled(enabled);
        channel.setConfig(Map.of("url", "http://localhost:8080/webhook"));
        return channel;
    }
}
