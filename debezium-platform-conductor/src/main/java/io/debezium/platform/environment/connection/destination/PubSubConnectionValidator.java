/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.Duration;

import com.google.api.gax.core.FixedCredentialsProvider;
import com.google.api.gax.core.NoCredentialsProvider;
import com.google.api.gax.grpc.GrpcTransportChannel;
import com.google.api.gax.rpc.ApiException;
import com.google.api.gax.rpc.FixedTransportChannelProvider;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.pubsub.v1.TopicAdminClient;
import com.google.cloud.pubsub.v1.TopicAdminSettings;
import com.google.pubsub.v1.ProjectName;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionValidator;
import io.debezium.util.Strings;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;

@ApplicationScoped
@Named("GOOGLE_PUB_SUB")
public class PubSubConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(PubSubConnectionValidator.class);

    public static final String PROJECT_ID_KEY = "project.id";
    public static final String CREDENTIALS_FILE_KEY = "credentials.file.path";
    public static final String CREDENTIALS_JSON_KEY = "credentials.json";
    public static final String ENDPOINT_KEY = "endpoint";

    public static final String DEFAULT_PUBSUB_SCOPE = "https://www.googleapis.com/auth/pubsub";

    private final int defaultTimeout;
    private final String pubsubScope;

    public PubSubConnectionValidator(
                                     @ConfigProperty(name = "destinations.pubsub.connection.timeout") int defaultTimeout,
                                     @ConfigProperty(name = "destinations.pubsub.connection.scope", defaultValue = DEFAULT_PUBSUB_SCOPE) String pubsubScope) {
        this.defaultTimeout = defaultTimeout;
        this.pubsubScope = pubsubScope;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        try {
            LOGGER.debug("Starting Google Pub/Sub connection validation for: {}", connectionConfig.getName());

            Map<String, Object> config = connectionConfig.getConfig();

            // First validate the basic correctness of required configuration properties
            ConnectionValidationResult configValidation = validateConfiguration(config);
            if (!configValidation.valid()) {
                return configValidation;
            }

            // Then attempt to perform an actual connection validation using the provided configuration
            return performConnectionValidation(config);
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Google Pub/Sub connection validation", e);
            return ConnectionValidationResult.failed("Unexpected error: " + e.getMessage());
        }
    }

    // Validates the presence and basic correctness of required configuration properties without making any network calls.
    private ConnectionValidationResult validateConfiguration(Map<String, Object> config) {
        Object projectId = config.get(PROJECT_ID_KEY);
        if (projectId == null || Strings.isNullOrBlank(projectId.toString())) {
            return ConnectionValidationResult.failed("GCP project.id must be specified");
        }

        boolean hasFilePath = config.containsKey(CREDENTIALS_FILE_KEY)
                && config.get(CREDENTIALS_FILE_KEY) != null
                && !Strings.isNullOrBlank(config.get(CREDENTIALS_FILE_KEY).toString());
        boolean hasJsonKey = config.containsKey(CREDENTIALS_JSON_KEY)
                && config.get(CREDENTIALS_JSON_KEY) != null
                && !Strings.isNullOrBlank(config.get(CREDENTIALS_JSON_KEY).toString());

        if (hasFilePath && hasJsonKey) {
            return ConnectionValidationResult.failed(
                    "Specify either credentials.file.path or credentials.json, not both");
        }

        return ConnectionValidationResult.successful();
    }

    // Performs the actual connection validation by attempting to list Pub/Sub topics using the provided configuration.
    private ConnectionValidationResult performConnectionValidation(Map<String, Object> config) {
        String projectId = config.get(PROJECT_ID_KEY).toString().trim();

        // If an endpoint is provided, we assume it's a Pub/Sub emulator and create a channel to it. Otherwise, we rely on the default gRPC transport which will use the standard Google Cloud endpoints.
        ManagedChannel channel = null;
        try {
            Object endpointValue = config.get(ENDPOINT_KEY);
            if (endpointValue != null && !Strings.isNullOrBlank(endpointValue.toString())) {
                channel = ManagedChannelBuilder.forTarget(endpointValue.toString().trim())
                        .usePlaintext()
                        .build();
            }

            TopicAdminSettings settings = buildTopicAdminSettings(config, channel);

            try (TopicAdminClient topicAdmin = TopicAdminClient.create(settings)) {
                LOGGER.debug("Probing Google Pub/Sub project '{}'", projectId);

                topicAdmin.listTopics(ProjectName.of(projectId)).getPage();

                LOGGER.debug("Successfully validated Google Pub/Sub connection for project '{}'", projectId);
                return ConnectionValidationResult.successful();
            }
        }
        catch (ApiException e) {
            LOGGER.warn("Google Pub/Sub API error during validation for project '{}'", projectId, e);
            return switch (e.getStatusCode().getCode()) {
                case NOT_FOUND -> ConnectionValidationResult.failed(
                        "GCP project '" + projectId + "' not found");
                case UNAUTHENTICATED -> ConnectionValidationResult.failed(
                        "Authentication failed — check service account credentials");
                case PERMISSION_DENIED -> ConnectionValidationResult.failed(
                        "Permission denied — ensure the service account has the roles/pubsub.viewer role or the pubsub.topics.list permission");
                case UNAVAILABLE -> ConnectionValidationResult.failed(
                        "Pub/Sub service unavailable — check network connectivity");
                default -> ConnectionValidationResult.failed(
                        "Pub/Sub validation failed: " + e.getMessage());
            };
        }
        catch (IOException e) {
            LOGGER.warn("Failed to load Google Pub/Sub credentials", e);
            return ConnectionValidationResult.failed("Failed to load credentials: " + e.getMessage());
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Google Pub/Sub connection validation", e);
            return ConnectionValidationResult.failed("Unexpected error: " + e.getMessage());
        }
        finally {
            // Ensure that the channel is properly shut down if it was created for emulator testing
            if (channel != null && !channel.isShutdown()) {
                channel.shutdownNow();
            }
        }
    }

    private TopicAdminSettings buildTopicAdminSettings(Map<String, Object> config, ManagedChannel channel)
            throws IOException {
        TopicAdminSettings.Builder builder = TopicAdminSettings.newBuilder();

        // If a custom endpoint is provided, configure the client to use it with no credentials (emulator mode).
        // Otherwise, configure credentials based on the provided configuration or rely on ADC.
        if (channel != null) {
            LOGGER.debug("Using custom Pub/Sub endpoint (emulator): {}", config.get(ENDPOINT_KEY));
            builder.setTransportChannelProvider(
                    FixedTransportChannelProvider.create(GrpcTransportChannel.create(channel)));
            builder.setCredentialsProvider(NoCredentialsProvider.create());
        }
        else {
            Object credentialsFilePath = config.get(CREDENTIALS_FILE_KEY);
            Object credentialsJson = config.get(CREDENTIALS_JSON_KEY);

            if (credentialsFilePath != null && !Strings.isNullOrBlank(credentialsFilePath.toString())) {
                LOGGER.debug("Loading Pub/Sub credentials from file: {}", credentialsFilePath);
                try (InputStream stream = new FileInputStream(credentialsFilePath.toString().trim())) {
                    GoogleCredentials credentials = GoogleCredentials.fromStream(stream)
                            .createScoped(pubsubScope);
                    builder.setCredentialsProvider(FixedCredentialsProvider.create(credentials));
                }
            }
            else if (credentialsJson != null && !Strings.isNullOrBlank(credentialsJson.toString())) {
                LOGGER.debug("Loading Pub/Sub credentials from inline JSON key");
                byte[] credentialBytes = credentialsJson.toString().getBytes(StandardCharsets.UTF_8);
                try (InputStream stream = new ByteArrayInputStream(credentialBytes)) {
                    GoogleCredentials credentials = GoogleCredentials.fromStream(stream)
                            .createScoped(pubsubScope);
                    builder.setCredentialsProvider(FixedCredentialsProvider.create(credentials));
                }
            }
        }

        builder.listTopicsSettings().setRetrySettings(
                builder.listTopicsSettings().getRetrySettings().toBuilder()
                        .setTotalTimeout(Duration.ofSeconds(defaultTimeout))
                        .build());

        return builder.build();
    }
}
