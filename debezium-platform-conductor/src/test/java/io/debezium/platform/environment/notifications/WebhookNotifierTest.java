/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.notifications;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.debezium.platform.config.AlertingConfigGroup;
import io.debezium.platform.data.model.AlertStateValue;
import io.debezium.platform.data.model.ChannelType;
import io.debezium.platform.data.model.NotificationChannelEntity;
import io.debezium.platform.data.model.Operator;
import io.debezium.platform.data.model.Severity;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;

class WebhookNotifierTest {

    MockWebServer mockServer;
    WebhookNotifier notifier;
    ObjectMapper objectMapper;
    AlertingConfigGroup.WebhookConfigGroup webhookConfig;

    @BeforeEach
    void setUp() throws IOException {
        mockServer = new MockWebServer();
        mockServer.start();
        objectMapper = new ObjectMapper();

        webhookConfig = mock(AlertingConfigGroup.WebhookConfigGroup.class);
        when(webhookConfig.maxAttempts()).thenReturn(1);
        when(webhookConfig.connectTimeout()).thenReturn(Duration.ofSeconds(5));
        when(webhookConfig.readTimeout()).thenReturn(Duration.ofSeconds(10));
        when(webhookConfig.allowPrivateNetworks()).thenReturn(true);

        AlertingConfigGroup alertingConfig = mock(AlertingConfigGroup.class);
        when(alertingConfig.webhook()).thenReturn(webhookConfig);

        notifier = new WebhookNotifier(alertingConfig, objectMapper);
        notifier.init();
    }

    @AfterEach
    void tearDown() throws IOException {
        mockServer.shutdown();
    }

    @Test
    void sendSuccessfulDelivery() throws InterruptedException {
        mockServer.enqueue(new MockResponse().setResponseCode(200));

        NotificationResult result = notifier.send(createNotification(), createChannel(mockServer.url("/webhook").toString()));

        assertThat(result.success()).isTrue();
        assertThat(result.message()).isEqualTo("HTTP 200");

        RecordedRequest request = mockServer.takeRequest();
        assertThat(request.getMethod()).isEqualTo("POST");
        assertThat(request.getHeader("Content-Type")).isEqualTo("application/json");

        String body = request.getBody().readUtf8();
        assertThat(body).contains("\"version\":\"1\"");
        assertThat(body).contains("\"status\":\"firing\"");
        assertThat(body).contains("\"ruleName\":\"test-rule\"");
        assertThat(body).contains("\"resolvedAt\":null");
    }

    @Test
    void sendResolvedStatus() throws InterruptedException {
        mockServer.enqueue(new MockResponse().setResponseCode(200));

        AlertNotification notification = new AlertNotification(
                "test-rule", "pipeline-1", "Test Pipeline",
                AlertStateValue.OK, Severity.WARNING, 50.0, 100.0,
                Operator.GREATER_THAN, "Resolved", Instant.parse("2026-07-30T10:00:00Z"),
                Instant.parse("2026-07-30T10:05:00Z"));

        notifier.send(notification, createChannel(mockServer.url("/webhook").toString()));

        RecordedRequest request = mockServer.takeRequest();
        String body = request.getBody().readUtf8();
        assertThat(body).contains("\"status\":\"resolved\"");
        assertThat(body).contains("\"resolvedAt\":\"2026-07-30T10:05:00Z\"");
    }

    @Test
    void sendCustomMethod() throws InterruptedException {
        mockServer.enqueue(new MockResponse().setResponseCode(200));

        NotificationChannelEntity channel = createChannel(mockServer.url("/webhook").toString());
        channel.setConfig(Map.of(
                Notifier.CONFIG_URL, mockServer.url("/webhook").toString(),
                Notifier.CONFIG_METHOD, "PUT"));

        notifier.send(createNotification(), channel);

        RecordedRequest request = mockServer.takeRequest();
        assertThat(request.getMethod()).isEqualTo("PUT");
    }

    @Test
    void sendCustomHeaders() throws InterruptedException {
        mockServer.enqueue(new MockResponse().setResponseCode(200));

        NotificationChannelEntity channel = createChannel(mockServer.url("/webhook").toString());
        channel.setConfig(Map.of(
                Notifier.CONFIG_URL, mockServer.url("/webhook").toString(),
                Notifier.CONFIG_HEADERS, Map.of("Authorization", "Bearer token123")));

        notifier.send(createNotification(), channel);

        RecordedRequest request = mockServer.takeRequest();
        assertThat(request.getHeader("Authorization")).isEqualTo("Bearer token123");
    }

    @Test
    void sendServerErrorExhaustsRetries() {
        when(webhookConfig.maxAttempts()).thenReturn(2);

        mockServer.enqueue(new MockResponse().setResponseCode(500));
        mockServer.enqueue(new MockResponse().setResponseCode(500));

        NotificationResult result = notifier.send(createNotification(), createChannel(mockServer.url("/webhook").toString()));

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("retry attempts exhausted");
        assertThat(mockServer.getRequestCount()).isEqualTo(2);
    }

    @Test
    void sendServerErrorThenSuccessOnRetry() {
        when(webhookConfig.maxAttempts()).thenReturn(2);

        mockServer.enqueue(new MockResponse().setResponseCode(500));
        mockServer.enqueue(new MockResponse().setResponseCode(200));

        NotificationResult result = notifier.send(createNotification(), createChannel(mockServer.url("/webhook").toString()));

        assertThat(result.success()).isTrue();
        assertThat(mockServer.getRequestCount()).isEqualTo(2);
    }

    @Test
    void sendRejectsLoopbackAddress() {
        when(webhookConfig.allowPrivateNetworks()).thenReturn(false);

        NotificationResult result = notifier.send(createNotification(), createChannel("http://127.0.0.1/webhook"));

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("non-public address");
    }

    @Test
    void sendRejectsSiteLocalAddress() {
        when(webhookConfig.allowPrivateNetworks()).thenReturn(false);

        NotificationResult result = notifier.send(createNotification(), createChannel("http://10.0.0.1/webhook"));

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("non-public address");
    }

    @Test
    void sendRejectsLinkLocalAddress() {
        when(webhookConfig.allowPrivateNetworks()).thenReturn(false);

        NotificationResult result = notifier.send(createNotification(), createChannel("http://169.254.1.1/webhook"));

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("non-public address");
    }

    @Test
    void sendAllowsPrivateWhenConfigured() {
        when(webhookConfig.allowPrivateNetworks()).thenReturn(true);
        mockServer.enqueue(new MockResponse().setResponseCode(200));

        NotificationResult result = notifier.send(createNotification(), createChannel(mockServer.url("/webhook").toString()));

        assertThat(result.success()).isTrue();
    }

    @Test
    void sendRejectsUnresolvableHost() {
        when(webhookConfig.allowPrivateNetworks()).thenReturn(false);

        NotificationResult result = notifier.send(createNotification(), createChannel("http://this-host-does-not-exist.invalid/webhook"));

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("Cannot resolve webhook host");
    }

    @Test
    void sendRejectsUrlWithNoHost() {
        when(webhookConfig.allowPrivateNetworks()).thenReturn(false);

        NotificationResult result = notifier.send(createNotification(), createChannel("not-a-url"));

        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("no host");
    }

    private AlertNotification createNotification() {
        return new AlertNotification(
                "test-rule", "pipeline-1", "Test Pipeline",
                AlertStateValue.FIRING, Severity.WARNING, 150.0, 100.0,
                Operator.GREATER_THAN, "Alert fired",
                Instant.parse("2026-07-30T10:00:00Z"), null);
    }

    private NotificationChannelEntity createChannel(String url) {
        NotificationChannelEntity channel = new NotificationChannelEntity();
        channel.setId(1L);
        channel.setName("test-webhook");
        channel.setType(ChannelType.WEBHOOK);
        channel.setEnabled(true);
        channel.setConfig(Map.of(Notifier.CONFIG_URL, url));
        return channel;
    }
}
