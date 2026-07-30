/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.domain.alert;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import jakarta.enterprise.inject.Instance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.debezium.platform.data.model.AlertEventEntity;
import io.debezium.platform.data.model.AlertRuleEntity;
import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.NotificationChannelEntity;
import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.Severity;
import io.debezium.platform.environment.notifications.NotificationResult;
import io.debezium.platform.environment.notifications.Notifier;

@ExtendWith(MockitoExtension.class)
class NotificationDispatcherTest {

    @Mock
    Instance<Notifier> notifiers;

    @Mock
    Notifier webhookNotifier;

    @Mock
    Notifier emailNotifier;

    NotificationDispatcher dispatcher;

    AlertRuleEntity rule;
    AlertEventEntity event;

    @BeforeEach
    void setUp() {
        dispatcher = new NotificationDispatcher(notifiers);

        rule = new AlertRuleEntity();
        rule.setId(1L);
        rule.setName("test-rule");
        rule.setOperator(Operator.GREATER_THAN);
        rule.setThreshold(100.0);
        rule.setSeverity(Severity.WARNING);

        event = new AlertEventEntity();
        event.setId(1L);
        event.setRuleName("test-rule");
        event.setPipelineId("pipeline-1");
        event.setValue(150.0);
        event.setThreshold(100.0);
        event.setSeverity(Severity.WARNING);
        event.setFiredAt(Instant.parse("2026-07-30T10:00:00Z"));
        event.setMessage("Alert fired");
    }

    @Test
    void dispatchSendsToMatchingNotifier() {
        NotificationChannelEntity channel = createChannel("webhook-channel", ChannelType.WEBHOOK, true);
        rule.setChannels(Set.of(channel));

        when(webhookNotifier.type()).thenReturn(ChannelType.WEBHOOK);
        when(notifiers.stream()).thenReturn(Stream.of(webhookNotifier));
        when(webhookNotifier.send(any(), any())).thenReturn(new NotificationResult(true, "OK"));

        dispatcher.dispatch(rule, event);

        verify(webhookNotifier).send(any(), any());
    }

    @Test
    void dispatchSkipsDisabledChannels() {
        NotificationChannelEntity channel = createChannel("webhook-channel", ChannelType.WEBHOOK, false);
        rule.setChannels(Set.of(channel));

        dispatcher.dispatch(rule, event);

        verify(notifiers, never()).stream();
    }

    @Test
    void dispatchHandlesMultipleChannels() {
        NotificationChannelEntity webhookChannel = createChannel("webhook-channel", ChannelType.WEBHOOK, true);
        NotificationChannelEntity emailChannel = createChannel("email-channel", ChannelType.EMAIL, true);
        rule.setChannels(Set.of(webhookChannel, emailChannel));

        when(webhookNotifier.type()).thenReturn(ChannelType.WEBHOOK);
        when(emailNotifier.type()).thenReturn(ChannelType.EMAIL);
        when(notifiers.stream()).thenReturn(Stream.of(webhookNotifier, emailNotifier))
                .thenReturn(Stream.of(webhookNotifier, emailNotifier));
        when(webhookNotifier.send(any(), any())).thenReturn(new NotificationResult(true, "OK"));
        when(emailNotifier.send(any(), any())).thenReturn(new NotificationResult(true, "OK"));

        dispatcher.dispatch(rule, event);

        verify(webhookNotifier).send(any(), any());
        verify(emailNotifier).send(any(), any());
    }

    @Test
    void dispatchContinuesWhenNotifierThrows() {
        NotificationChannelEntity webhookChannel = createChannel("webhook-channel", ChannelType.WEBHOOK, true);
        NotificationChannelEntity emailChannel = createChannel("email-channel", ChannelType.EMAIL, true);
        rule.setChannels(Set.of(webhookChannel, emailChannel));

        when(webhookNotifier.type()).thenReturn(ChannelType.WEBHOOK);
        when(emailNotifier.type()).thenReturn(ChannelType.EMAIL);
        when(notifiers.stream()).thenReturn(Stream.of(webhookNotifier, emailNotifier))
                .thenReturn(Stream.of(webhookNotifier, emailNotifier));
        when(webhookNotifier.send(any(), any())).thenThrow(new RuntimeException("Connection refused"));
        when(emailNotifier.send(any(), any())).thenReturn(new NotificationResult(true, "OK"));

        dispatcher.dispatch(rule, event);

        verify(emailNotifier).send(any(), any());
    }

    @Test
    void dispatchHandlesNoMatchingNotifier() {
        NotificationChannelEntity channel = createChannel("webhook-channel", ChannelType.WEBHOOK, true);
        rule.setChannels(Set.of(channel));

        when(notifiers.stream()).thenReturn(Stream.empty());

        dispatcher.dispatch(rule, event);
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
