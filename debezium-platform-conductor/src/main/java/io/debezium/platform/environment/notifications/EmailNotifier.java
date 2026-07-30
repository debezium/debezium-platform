/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.notifications;

import java.util.List;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.NotificationChannelEntity;
import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;

@ApplicationScoped
public class EmailNotifier implements Notifier {

    private static final Logger LOGGER = Logger.getLogger(EmailNotifier.class);
    private static final String DEFAULT_SUBJECT_TEMPLATE = "Debezium Alert: {{rule_name}} - {{severity}}";
    private static final String RULE_NAME_PLACEHOLDER = "{{rule_name}}";
    private static final String SEVERITY_PLACEHOLDER = "{{severity}}";
    private static final String STATUS_FIRING = "FIRING";
    private static final String STATUS_RESOLVED = "RESOLVED";

    private final Mailer mailer;

    public EmailNotifier(Mailer mailer) {
        this.mailer = mailer;
    }

    @Override
    public ChannelType type() {
        return ChannelType.EMAIL;
    }

    @Override
    @SuppressWarnings("unchecked")
    public NotificationResult send(AlertNotification notification, NotificationChannelEntity channel) {
        Map<String, Object> config = channel.getConfig();
        List<String> recipients = (List<String>) config.get(CONFIG_RECIPIENTS);
        String subjectTemplate = (String) config.getOrDefault(CONFIG_SUBJECT_TEMPLATE, DEFAULT_SUBJECT_TEMPLATE);

        String subject = subjectTemplate
                .replace(RULE_NAME_PLACEHOLDER, notification.ruleName())
                .replace(SEVERITY_PLACEHOLDER, notification.severity().name());

        String body = buildEmailBody(notification);

        try {
            Mail mail = Mail.withText(recipients.get(0), subject, body);
            for (int i = 1; i < recipients.size(); i++) {
                mail.addTo(recipients.get(i));
            }
            mailer.send(mail);
            return new NotificationResult(true, "Email sent to " + recipients.size() + " recipient(s)");
        }
        catch (Exception e) {
            LOGGER.errorv("Failed to send email notification for rule ''{0}'': {1}", notification.ruleName(), e.getMessage());
            return new NotificationResult(false, "Email delivery failed: " + e.getMessage());
        }
    }

    private String buildEmailBody(AlertNotification notification) {
        String status = notification.resolvedAt() == null ? STATUS_FIRING : STATUS_RESOLVED;
        String pipelineName = notification.pipelineName() != null
                ? notification.pipelineName()
                : notification.pipelineId();

        return """
                Alert Status: %s
                Rule: %s
                Severity: %s
                Pipeline: %s (%s)

                %s

                Value: %.4f
                Threshold: %.4f (%s)
                Fired at: %s
                %s""".formatted(
                status,
                notification.ruleName(),
                notification.severity(),
                pipelineName, notification.pipelineId(),
                notification.message(),
                notification.value(),
                notification.threshold(), notification.operator(),
                notification.firedAt(),
                notification.resolvedAt() != null ? "Resolved at: " + notification.resolvedAt() : "");
    }
}
