/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.notifications;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.MediaType;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.NotificationChannelEntity;

@ApplicationScoped
public class WebhookNotifier implements Notifier {

    private static final Logger LOGGER = Logger.getLogger(WebhookNotifier.class);

    private static final String DEFAULT_METHOD = "POST";
    private static final String CONTENT_TYPE_HEADER = "Content-Type";
    private static final String PAYLOAD_VERSION = "1";
    private static final String STATUS_FIRING = "firing";
    private static final String STATUS_RESOLVED = "resolved";
    private static final long[] RETRY_DELAYS_MS = { 1000, 5000, 30000 };

    @ConfigProperty(name = "alerting.webhook.max-attempts", defaultValue = "3")
    int maxAttempts;

    @ConfigProperty(name = "alerting.webhook.connect-timeout", defaultValue = "5S")
    Duration connectTimeout;

    @ConfigProperty(name = "alerting.webhook.read-timeout", defaultValue = "10S")
    Duration readTimeout;

    private HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public WebhookNotifier(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void init() {
        httpClient = HttpClient.newBuilder()
                .connectTimeout(connectTimeout)
                .build();
    }

    @Override
    public ChannelType type() {
        return ChannelType.WEBHOOK;
    }

    @Override
    @SuppressWarnings("unchecked")
    public NotificationResult send(AlertNotification notification, NotificationChannelEntity channel) {
        Map<String, Object> config = channel.getConfig();
        String url = (String) config.get(CONFIG_URL);
        String method = (String) config.getOrDefault(CONFIG_METHOD, DEFAULT_METHOD);
        Map<String, String> headers = (Map<String, String>) config.getOrDefault(CONFIG_HEADERS, Map.of());

        String payload;
        try {
            payload = buildPayload(notification);
        }
        catch (JsonProcessingException e) {
            return new NotificationResult(false, "Failed to serialize payload: " + e.getMessage());
        }

        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(readTimeout)
                        .header(CONTENT_TYPE_HEADER, MediaType.APPLICATION_JSON)
                        .method(method, HttpRequest.BodyPublishers.ofString(payload));

                headers.forEach(requestBuilder::header);

                HttpResponse<String> response = httpClient.send(requestBuilder.build(),
                        HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    return new NotificationResult(true, "HTTP " + response.statusCode());
                }
                LOGGER.warnv("Webhook returned HTTP {0} (attempt {1}/{2})", response.statusCode(), attempt + 1, maxAttempts);
            }
            catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return new NotificationResult(false, "Interrupted during webhook delivery");
            }
            catch (Exception e) {
                LOGGER.warnv("Webhook failed (attempt {0}/{1}): {2}", attempt + 1, maxAttempts, e.getMessage());
            }

            if (attempt < maxAttempts - 1) {
                try {
                    Thread.sleep(RETRY_DELAYS_MS[attempt]);
                }
                catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return new NotificationResult(false, "Interrupted during retry backoff");
                }
            }
        }
        return new NotificationResult(false, "All " + maxAttempts + " retry attempts exhausted");
    }

    private String buildPayload(AlertNotification notification) throws JsonProcessingException {
        String status = notification.resolvedAt() == null ? STATUS_FIRING : STATUS_RESOLVED;

        Map<String, Object> payload = Map.of(
                "version", PAYLOAD_VERSION,
                "status", status,
                "alert", Map.of(
                        "ruleName", notification.ruleName(),
                        "severity", notification.severity().name(),
                        "pipelineId", notification.pipelineId(),
                        "pipelineName", notification.pipelineName() != null ? notification.pipelineName() : notification.pipelineId(),
                        "value", notification.value(),
                        "threshold", notification.threshold(),
                        "operator", notification.operator().name(),
                        "message", notification.message(),
                        "firedAt", notification.firedAt().toString()));

        return objectMapper.writeValueAsString(payload);
    }
}
