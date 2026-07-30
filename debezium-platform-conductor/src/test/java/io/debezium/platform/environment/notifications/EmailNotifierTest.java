/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.notifications;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.NotificationChannelEntity;
import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.Severity;
import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;

@ExtendWith(MockitoExtension.class)
class EmailNotifierTest {

    @Mock
    Mailer mailer;

    EmailNotifier notifier;

    @BeforeEach
    void setUp() {
        notifier = new EmailNotifier(mailer);
    }

    @Test
    void typeReturnsEmail() {
        assertThat(notifier.type()).isEqualTo(ChannelType.EMAIL);
    }

    @Test
    void sendSingleRecipient() {
        NotificationResult result = notifier.send(createFiringNotification(), createChannel(List.of("admin@example.com")));

        assertThat(result.success()).isTrue();
        assertThat(result.message()).contains("1 recipient");

        ArgumentCaptor<Mail> captor = ArgumentCaptor.forClass(Mail.class);
        verify(mailer).send(captor.capture());

        Mail mail = captor.getValue();
        assertThat(mail.getTo()).containsExactly("admin@example.com");
        assertThat(mail.getSubject()).isEqualTo("Debezium Alert: test-rule - WARNING");
        assertThat(mail.getText()).contains("Alert Status: FIRING");
        assertThat(mail.getText()).contains("Rule: test-rule");
        assertThat(mail.getText()).contains("Pipeline: Test Pipeline (pipeline-1)");
    }

    @Test
    void sendMultipleRecipients() {
        NotificationResult result = notifier.send(
                createFiringNotification(),
                createChannel(List.of("admin@example.com", "ops@example.com", "oncall@example.com")));

        assertThat(result.success()).isTrue();
        assertThat(result.message()).contains("3 recipient");

        ArgumentCaptor<Mail> captor = ArgumentCaptor.forClass(Mail.class);
        verify(mailer).send(captor.capture());

        Mail mail = captor.getValue();
        assertThat(mail.getTo()).containsExactlyInAnyOrder("admin@example.com", "ops@example.com", "oncall@example.com");
    }

    @Test
    void sendCustomSubjectTemplate() {
        NotificationChannelEntity channel = createChannel(List.of("admin@example.com"));
        channel.setConfig(Map.of(
                Notifier.CONFIG_RECIPIENTS, List.of("admin@example.com"),
                Notifier.CONFIG_SUBJECT_TEMPLATE, "[{{severity}}] Alert: {{rule_name}}"));

        NotificationResult result = notifier.send(createFiringNotification(), channel);

        assertThat(result.success()).isTrue();

        ArgumentCaptor<Mail> captor = ArgumentCaptor.forClass(Mail.class);
        verify(mailer).send(captor.capture());
        assertThat(captor.getValue().getSubject()).isEqualTo("[WARNING] Alert: test-rule");
    }

    @Test
    void sendResolvedNotification() {
        AlertNotification resolved = new AlertNotification(
                "test-rule", "pipeline-1", "Test Pipeline",
                AlertStateValue.OK, Severity.WARNING, 50.0, 100.0,
                Operator.GREATER_THAN, "Resolved",
                Instant.parse("2026-07-30T10:00:00Z"), Instant.parse("2026-07-30T10:05:00Z"));

        notifier.send(resolved, createChannel(List.of("admin@example.com")));

        ArgumentCaptor<Mail> captor = ArgumentCaptor.forClass(Mail.class);
        verify(mailer).send(captor.capture());
        assertThat(captor.getValue().getText()).contains("Alert Status: RESOLVED");
        assertThat(captor.getValue().getText()).contains("Resolved at:");
    }

    @Test
    void sendMailerFailureReturnsFailure() {
        doThrow(new RuntimeException("SMTP connection refused")).when(mailer).send(any(Mail.class));

        NotificationResult result = notifier.send(createFiringNotification(), createChannel(List.of("admin@example.com")));

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("Email delivery failed");
        assertThat(result.message()).contains("SMTP connection refused");
    }

    @Test
    void sendNullPipelineNameFallsToPipelineId() {
        AlertNotification notification = new AlertNotification(
                "test-rule", "pipeline-1", null,
                AlertStateValue.FIRING, Severity.WARNING, 150.0, 100.0,
                Operator.GREATER_THAN, "Alert fired",
                Instant.parse("2026-07-30T10:00:00Z"), null);

        notifier.send(notification, createChannel(List.of("admin@example.com")));

        ArgumentCaptor<Mail> captor = ArgumentCaptor.forClass(Mail.class);
        verify(mailer).send(captor.capture());
        assertThat(captor.getValue().getText()).contains("Pipeline: pipeline-1 (pipeline-1)");
    }

    private AlertNotification createFiringNotification() {
        return new AlertNotification(
                "test-rule", "pipeline-1", "Test Pipeline",
                AlertStateValue.FIRING, Severity.WARNING, 150.0, 100.0,
                Operator.GREATER_THAN, "Alert fired",
                Instant.parse("2026-07-30T10:00:00Z"), null);
    }

    private NotificationChannelEntity createChannel(List<String> recipients) {
        NotificationChannelEntity channel = new NotificationChannelEntity();
        channel.setId(1L);
        channel.setName("test-email");
        channel.setType(ChannelType.EMAIL);
        channel.setEnabled(true);
        channel.setConfig(Map.of(Notifier.CONFIG_RECIPIENTS, recipients));
        return channel;
    }
}
