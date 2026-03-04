/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.connection;

import java.util.Map;

import org.testcontainers.azure.AzuriteContainer;
import org.testcontainers.azure.EventHubsEmulatorContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.utility.MountableFile;

import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;

public class AzureEventHubsTestResource implements QuarkusTestResourceLifecycleManager {

    private static final String AZURITE_IMAGE = "mcr.microsoft.com/azure-storage/azurite:3.33.0";
    private static final String EVENTHUBS_EMULATOR_IMAGE = "mcr.microsoft.com/azure-messaging/eventhubs-emulator:2.0.1";

    private static Network network;
    private static AzuriteContainer azurite;
    private static EventHubsEmulatorContainer emulator;

    @Override
    public Map<String, String> start() {
        network = Network.newNetwork();

        azurite = new AzuriteContainer(AZURITE_IMAGE)
                .withNetwork(network);
        azurite.start();

        emulator = new EventHubsEmulatorContainer(EVENTHUBS_EMULATOR_IMAGE)
                .acceptLicense()
                .withNetwork(network)
                .withConfig(MountableFile.forClasspathResource("/azure_eventhubs_emulator_config.json"))
                .withAzuriteContainer(azurite);
        emulator.start();

        return Map.of(
                "destinations.eventhubs.connection.timeout", "60");
    }

    public static String getConnectionString() {
        return emulator.getConnectionString();
    }

    @Override
    public void stop() {
        if (emulator != null) {
            emulator.stop();
        }
        if (azurite != null) {
            azurite.stop();
        }
        if (network != null) {
            network.close();
        }
    }
}
