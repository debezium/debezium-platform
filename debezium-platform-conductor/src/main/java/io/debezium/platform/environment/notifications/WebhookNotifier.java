/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.notifications;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.Map;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.MediaType;

import org.jboss.logging.Logger;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.debezium.platform.config.AlertingConfigGroup;
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

    private final AlertingConfigGroup.WebhookConfigGroup webhookConfig;
    private final ObjectMapper objectMapper;
    private HttpClient httpClient;

    public WebhookNotifier(AlertingConfigGroup alertingConfig, ObjectMapper objectMapper) {
        this.webhookConfig = alertingConfig.webhook();
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void init() {
        httpClient = HttpClient.newBuilder()
                .connectTimeout(webhookConfig.connectTimeout())
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

        NotificationResult ssrfCheck = validateUrl(url);
        if (ssrfCheck != null) {
            return ssrfCheck;
        }

        String payload;
        try {
            payload = buildPayload(notification);
        }
        catch (JsonProcessingException e) {
            return new NotificationResult(false, "Failed to serialize payload: " + e.getMessage());
        }

        int maxAttempts = webhookConfig.maxAttempts();
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(webhookConfig.readTimeout())
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

    NotificationResult validateUrl(String url) {
        try {
            String host = URI.create(url).getHost();
            if (host == null) {
                return new NotificationResult(false, "Invalid webhook URL: no host");
            }
            if (!webhookConfig.allowPrivateNetworks()) {
                InetAddress[] addresses = InetAddress.getAllByName(host);
                for (InetAddress addr : addresses) {
                    if (addr.isLoopbackAddress() || addr.isSiteLocalAddress()
                            || addr.isLinkLocalAddress() || addr.isAnyLocalAddress()) {
                        return new NotificationResult(false,
                                "Webhook URL resolves to non-public address: " + addr.getHostAddress());
                    }
                }
            }
        }
        catch (UnknownHostException e) {
            return new NotificationResult(false, "Cannot resolve webhook host: " + e.getMessage());
        }
        return null;
    }

    private String buildPayload(AlertNotification notification) throws JsonProcessingException {
        boolean resolved = notification.resolvedAt() != null;
        String status = resolved ? STATUS_RESOLVED : STATUS_FIRING;

        // LinkedHashMap (not Map.of) so the key order is stable and resolvedAt can carry a null value while firing.
        Map<String, Object> alert = new LinkedHashMap<>();
        alert.put("ruleName", notification.ruleName());
        alert.put("severity", notification.severity().name());
        alert.put("pipelineId", notification.pipelineId());
        alert.put("pipelineName", notification.pipelineName() != null ? notification.pipelineName() : notification.pipelineId());
        alert.put("value", notification.value());
        alert.put("threshold", notification.threshold());
        alert.put("operator", notification.operator().name());
        alert.put("message", notification.message());
        alert.put("firedAt", notification.firedAt().toString());
        alert.put("resolvedAt", resolved ? notification.resolvedAt().toString() : null);

        Map<String, Object> payload = Map.of(
                "version", PAYLOAD_VERSION,
                "status", status,
                "alert", alert);

        return objectMapper.writeValueAsString(payload);
    }
}
