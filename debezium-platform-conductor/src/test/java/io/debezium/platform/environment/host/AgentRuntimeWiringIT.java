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

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

/** Verifies CDI selects the Agent implementation only in Agent runtime mode. */
@QuarkusTest
@TestProfile(AgentRuntimeTestProfile.class)
public class AgentRuntimeWiringIT {

    @Inject
    Instance<HostContainerRuntime> containerRuntime;

    @Test
    public void shouldSelectAgentRuntime() {
        assertThat(containerRuntime.isResolvable()).isTrue();
        assertThat(containerRuntime.get()).isInstanceOf(AgentContainerRuntime.class);
    }
}
