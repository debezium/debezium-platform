/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.time.Duration;
import java.util.Map;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.azure.core.amqp.AmqpRetryOptions;
import com.azure.core.amqp.exception.AmqpException;
import com.azure.core.exception.AzureException;
import com.azure.core.exception.ClientAuthenticationException;
import com.azure.messaging.eventhubs.EventHubClientBuilder;
import com.azure.messaging.eventhubs.EventHubProducerClient;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionValidator;
import io.debezium.util.Strings;

/**
 * Implementation of {@link ConnectionValidator} for Azure Event Hubs connections.
 * <p>
 * This validator performs validation of Azure Event Hubs connection configurations
 * by attempting to connect and retrieve Event Hub metadata.
 * </p>
 *
 * <p>
 * The validation process includes:
 * <ul>
 *   <li>Connection string and hub name presence checks</li>
 *   <li>Network connectivity verification via metadata retrieval</li>
 *   <li>Authentication validation against the Event Hubs namespace</li>
 * </ul>
 * </p>
 */
@Named("EVENTHUBS")
@ApplicationScoped
public class AzureEventHubsConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(AzureEventHubsConnectionValidator.class);

    public static final String CONNECTION_STRING_KEY = "connectionstring";
    public static final String HUB_NAME_KEY = "hubname";

    private final int defaultConnectionTimeout;

    public AzureEventHubsConnectionValidator(@ConfigProperty(name = "destinations.eventhubs.connection.timeout") int defaultConnectionTimeout) {
        this.defaultConnectionTimeout = defaultConnectionTimeout;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        try {
            LOGGER.debug("Starting Azure Event Hubs connection validation for connection: {}", connectionConfig.getName());

            Map<String, Object> config = connectionConfig.getConfig();

            if (Strings.isNullOrBlank(getConfigString(config, CONNECTION_STRING_KEY))) {
                return ConnectionValidationResult.failed("Event Hubs connection string must be specified");
            }

            if (Strings.isNullOrBlank(getConfigString(config, HUB_NAME_KEY))) {
                return ConnectionValidationResult.failed("Event Hub name must be specified");
            }

            String connectionString = getConfigString(config, CONNECTION_STRING_KEY);
            String hubName = getConfigString(config, HUB_NAME_KEY);

            return performConnectionValidation(connectionString, hubName);
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Azure Event Hubs connection validation", e);
            return ConnectionValidationResult.failed("Validation failed due to unexpected error: " + e.getMessage());
        }
    }

    private ConnectionValidationResult performConnectionValidation(String connectionString, String hubName) {
        EventHubProducerClient producer = null;

        try {
            LOGGER.debug("Creating EventHubProducerClient for validation");
            producer = createProducerClient(connectionString, hubName);

            LOGGER.debug("Attempting to retrieve Event Hub properties");
            var properties = producer.getEventHubProperties();

            LOGGER.debug("Successfully connected to Event Hub '{}' with {} partition(s)",
                    properties.getName(), properties.getPartitionIds().stream().count());

            return ConnectionValidationResult.successful();
        }
        catch (ClientAuthenticationException e) {
            LOGGER.warn("Authentication failed for Azure Event Hubs", e);
            return ConnectionValidationResult.failed(
                    "Authentication failed - please check connection string credentials");
        }
        catch (AmqpException e) {
            LOGGER.warn("AMQP error during Azure Event Hubs connection validation", e);
            if (e.isTransient()) {
                return ConnectionValidationResult.failed(
                        "Transient connection error - please retry or check network connectivity");
            }
            return ConnectionValidationResult.failed(
                    "Failed to connect to Azure Event Hubs: " + e.getMessage());
        }
        catch (AzureException e) {
            LOGGER.warn("Azure error during Event Hubs connection validation", e);
            return ConnectionValidationResult.failed(
                    "Azure Event Hubs connection error: " + e.getMessage());
        }
        catch (IllegalArgumentException e) {
            LOGGER.warn("Invalid connection string format", e);
            return ConnectionValidationResult.failed(
                    "Invalid connection string format - please verify the connection string");
        }
        catch (Exception e) {
            LOGGER.error("Unexpected error during Azure Event Hubs connection validation", e);
            return ConnectionValidationResult.failed(
                    "Generic error while connecting to Azure Event Hubs");
        }
        finally {
            if (producer != null) {
                try {
                    LOGGER.debug("Closing EventHubProducerClient");
                    producer.close();
                }
                catch (Exception e) {
                    LOGGER.warn("Error closing EventHubProducerClient", e);
                }
            }
        }
    }

    EventHubProducerClient createProducerClient(String connectionString, String hubName) {
        AmqpRetryOptions retryOptions = new AmqpRetryOptions()
                .setMaxRetries(0)
                .setTryTimeout(Duration.ofSeconds(defaultConnectionTimeout));

        return new EventHubClientBuilder()
                .connectionString(connectionString, hubName)
                .retryOptions(retryOptions)
                .buildProducerClient();
    }

    private String getConfigString(Map<String, Object> config, String key) {
        Object value = config.get(key);
        return value == null ? null : value.toString();
    }
}
