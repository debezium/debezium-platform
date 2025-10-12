/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.database.db;

import java.net.URI;
import java.util.Map;

import org.testcontainers.containers.localstack.LocalStackContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.kinesis.model.CreateStreamRequest;
import software.amazon.awssdk.services.kinesis.model.ResourceInUseException;

/**
 * Testcontainers resource for LocalStack (AWS local emulator) with Kinesis service.
 * <p>
 * This resource manages the lifecycle of a LocalStack container that emulates AWS Kinesis
 * for integration testing purposes. It provides a local Kinesis instance without requiring
 * real AWS credentials or incurring AWS costs.
 * </p>
 *
 * <p>
 * The resource performs the following setup:
 * <ul>
 *   <li>Starts a LocalStack Docker container with Kinesis service enabled</li>
 *   <li>Creates a test Kinesis stream named "test-stream" with 1 shard</li>
 *   <li>Waits for the stream to become ACTIVE before tests run (up to 30 seconds)</li>
 *   <li>Provides configuration properties for connecting to the local endpoint</li>
 * </ul>
 * </p>
 *
 * <p>
 * Configuration properties exposed to tests:
 * <ul>
 *   <li><code>kinesis.endpoint</code> - LocalStack Kinesis endpoint URL</li>
 *   <li><code>kinesis.region</code> - AWS region (e.g., us-east-1)</li>
 *   <li><code>kinesis.streamName</code> - The pre-created test stream name</li>
 * </ul>
 * </p>
 *
 * <p>
 * Usage in integration tests:
 * <pre>
 * {@code
 * @QuarkusTest
 * @QuarkusTestResource(KinesisTestResource.class)
 * public class KinesisConnectionValidatorIT {
 *     @Test
 *     void testKinesisConnection() {
 *         String endpoint = ConfigProvider.getConfig().getValue("kinesis.endpoint", String.class);
 *         String region = ConfigProvider.getConfig().getValue("kinesis.region", String.class);
 *         String stream = ConfigProvider.getConfig().getValue("kinesis.streamName", String.class);
 *         // Use these properties to test Kinesis connection
 *     }
 * }
 * }
 * </pre>
 * </p>
 *
 * @author Pranav Kumar Tiwari
 */
public class KinesisTestResource implements QuarkusTestResourceLifecycleManager {

    private LocalStackContainer localStack;
    private final String streamName = "test-stream";

    /**
     * Starts the LocalStack container and creates a test Kinesis stream.
     * This method is called before any tests run.
     *
     * @return Map of configuration properties to inject into test context
     */
    @Override
    public Map<String, String> start() {
        // Start LocalStack container with Kinesis service
        localStack = new LocalStackContainer(DockerImageName.parse("localstack/localstack:latest"))
                .withServices(LocalStackContainer.Service.KINESIS);
        localStack.start();

        // Get LocalStack endpoint and region
        String endpoint = localStack.getEndpointOverride(LocalStackContainer.Service.KINESIS).toString();
        String region = localStack.getRegion();

        // Create Kinesis client pointing to LocalStack
        KinesisClient kinesisClient = KinesisClient.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of(region))
                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                AwsBasicCredentials.create("accessKey", "secretKey"))) // LocalStack dummy credentials
                .build();

        // Create a test stream for integration tests
        try {
            kinesisClient.createStream(CreateStreamRequest.builder()
                    .streamName(streamName)
                    .shardCount(1)
                    .build());
        }
        catch (ResourceInUseException e) {
            // Stream already exists, ignore
        }

        // Wait for stream to become ACTIVE before tests run
        waitForStreamToBecomeActive(kinesisClient, streamName);

        // Return configuration properties for tests to use
        return Map.of(
                "kinesis.endpoint", endpoint,
                "kinesis.region", region,
                "kinesis.streamName", "test-stream");
    }

    /**
     * Stops the LocalStack container.
     * This method is called after all tests have completed.
     */
    @Override
    public void stop() {
        if (localStack != null) {
            localStack.stop();
        }
    }

    /**
     * Waits for the Kinesis stream to reach ACTIVE status.
     * This is necessary because stream creation is asynchronous and tests
     * will fail if they try to use a stream that isn't ready yet.
     *
     * @param client the Kinesis client to use for status checks
     * @param streamName the name of the stream to wait for
     * @throws RuntimeException if the stream doesn't become ACTIVE within 30 seconds
     */
    private void waitForStreamToBecomeActive(KinesisClient client, String streamName) {
        // Poll stream status every second for up to 30 seconds
        for (int i = 0; i < 30; i++) {
            var desc = client.describeStream(b -> b.streamName(streamName));
            if ("ACTIVE".equals(desc.streamDescription().streamStatusAsString())) {
                return; // Stream is ready
            }
            try {
                Thread.sleep(1000); // Wait 1 second before next check
            }
            catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        throw new RuntimeException("Stream did not become ACTIVE within timeout");
    }
}
