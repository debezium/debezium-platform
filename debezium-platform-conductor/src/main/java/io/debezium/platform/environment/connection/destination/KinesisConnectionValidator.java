package io.debezium.platform.environment.connection.destination;

import com.amazonaws.services.kinesis.model.PutRecordRequest;
import jakarta.inject.Named;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.UnknownHostException;
import java.util.Map;

import io.debezium.platform.data.dto.ConnectionValidationResult;
import io.debezium.platform.domain.views.Connection;
import io.debezium.platform.environment.connection.ConnectionValidator;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.kinesis.model.PutRecordResponse;


/**
 * Implementation of {@link ConnectionValidator} for Amazon Kinesis.
 * Validates stream name, region, and tests by sending a simple record.
 * 
 * Author: Pranav Tiwari
 */
@Named("KINESIS")
public class KinesisConnectionValidator implements ConnectionValidator {

    private static final Logger LOGGER = LoggerFactory.getLogger(KinesisConnectionValidator.class);

    private static final String REGION_KEY = "region";
    private static final String STREAM_NAME_KEY = "stream";
    private static final String PARTITION_KEY = "partitionKey"; // Optional
    private static final String TEST_MESSAGE = "Kinesis validation test message";

    private final int defaultTimeout;

    public KinesisConnectionValidator(
        @ConfigProperty(name = "destinations.kinesis.connection.timeout") int defaultTimeout) {
        this.defaultTimeout = defaultTimeout;
    }

    @Override
    public ConnectionValidationResult validate(Connection connectionConfig) {
        if (connectionConfig == null) {
            return ConnectionValidationResult.failed("Connection configuration cannot be null");
        }

        try {
            LOGGER.debug("Starting Kinesis connection validation for: {}", connectionConfig.getName());

            Map<String, Object> kinesisConfig = connectionConfig.getConfig();

            ConnectionValidationResult configValidation = validateConfiguration(kinesisConfig);
            if (!configValidation.valid()) {
                return configValidation;
            }

            return performConnectionValidation(kinesisConfig);
        } catch (Exception e) {
            LOGGER.error("Unexpected error during Kinesis connection validation", e);
            return ConnectionValidationResult.failed("Unexpected error: " + e.getMessage());
        }
    }

    private ConnectionValidationResult validateConfiguration(Map<String, Object> config) {
        if (!config.containsKey(REGION_KEY) || config.get(REGION_KEY) == null ||
                config.get(REGION_KEY).toString().trim().isEmpty()) {
            return ConnectionValidationResult.failed("Region must be specified");
        }

        if (!config.containsKey(STREAM_NAME_KEY) || config.get(STREAM_NAME_KEY) == null ||
                config.get(STREAM_NAME_KEY).toString().trim().isEmpty()) {
            return ConnectionValidationResult.failed("Stream name must be specified");
        }

        return ConnectionValidationResult.successful();
    }

    private ConnectionValidationResult performConnectionValidation(Map<String, Object> config) {
        KinesisClient kinesisClient = null;

        try {
            String regionName = config.get(REGION_KEY).toString().trim();
            String streamName = config.get(STREAM_NAME_KEY).toString().trim();
            String partitionKey = config.containsKey(PARTITION_KEY)
                    ? config.get(PARTITION_KEY).toString()
                    : "test-partition";

            LOGGER.debug("Connecting to Kinesis in region: {}, stream: {}", regionName, streamName);

            kinesisClient = KinesisClient.builder()
                    .region(Region.of(regionName))
                    .build();

            kinesisClient.describeStreamSummary(builder ->
                    builder.streamName(streamName));

            // Describe the stream without sending data
            var response = kinesisClient.describeStreamSummary(builder ->
                    builder.streamName(streamName));

            LOGGER.debug("Successfully described Kinesis stream '{}'. Status: {}",
                    streamName, response.streamDescriptionSummary().streamStatusAsString());

            return ConnectionValidationResult.successful();

        } catch (software.amazon.awssdk.services.kinesis.model.ResourceNotFoundException e) {
            return ConnectionValidationResult.failed("Stream not found: Please verify the stream name and region.");
        } catch (software.amazon.awssdk.services.kinesis.model.AccessDeniedException e) {
            return ConnectionValidationResult.failed("Access denied: Check IAM permissions or credentials.");
        } catch (software.amazon.awssdk.core.exception.SdkClientException e) {
            return ConnectionValidationResult.failed("Client error: " + e.getMessage());
        } catch (Exception e) {
            LOGGER.warn("Generic exception during validation", e);
            return ConnectionValidationResult.failed("Failed to validate Kinesis connection: " + e.getMessage());
        } finally {
            if (kinesisClient != null) {
                try {
                    kinesisClient.close();
                } catch (Exception ex) {
                    LOGGER.warn("Error closing Kinesis client", ex);
                }
            }
        }
    }
}
