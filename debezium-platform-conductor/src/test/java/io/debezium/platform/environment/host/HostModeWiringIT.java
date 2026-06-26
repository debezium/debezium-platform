/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

import org.junit.jupiter.api.Test;

import io.debezium.platform.environment.EnvironmentController;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

/**
 * Verifies that CDI bean selection via {@code @LookupIfProperty} correctly
 * activates {@link HostEnvironmentController} when
 * {@code debezium.deployment.mode=host}.
 */
@QuarkusTest
@TestProfile(HostModeTestProfile.class)
public class HostModeWiringIT {

    @Inject
    Instance<EnvironmentController> environmentController;

    @Test
    public void shouldActivateHostControllerWhenModeIsHost() {
        assertThat(environmentController.isResolvable())
                .as("Exactly one EnvironmentController should be resolvable in host mode")
                .isTrue();

        var controller = environmentController.get();
        assertThat(controller)
                .as("The resolved controller should be HostEnvironmentController")
                .isInstanceOf(HostEnvironmentController.class);
    }

    @Test
    public void shouldProvideHostVaultController() {
        var controller = environmentController.get();
        assertThat(controller.vaults())
                .as("Host mode vaults() should return HostVaultController")
                .isInstanceOf(HostVaultController.class);
    }
}
