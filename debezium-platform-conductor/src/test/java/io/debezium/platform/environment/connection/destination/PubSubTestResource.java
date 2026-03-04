/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection.destination;

import java.util.Map;

import org.testcontainers.containers.PubSubEmulatorContainer;
import org.testcontainers.utility.DockerImageName;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class PubSubTestResource implements QuarkusTestResourceLifecycleManager {

    private static final PubSubEmulatorContainer PUBSUB_EMULATOR = new PubSubEmulatorContainer(
            DockerImageName.parse("gcr.io/google.com/cloudsdktool/google-cloud-cli:emulators"));

    public static String getEmulatorEndpoint() {
        return PUBSUB_EMULATOR.getEmulatorEndpoint();
    }

    @Override
    public Map<String, String> start() {
        PUBSUB_EMULATOR.start();
        return Map.of();
    }

    @Override
    public void stop() {
        PUBSUB_EMULATOR.stop();
    }
}
