/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import io.debezium.platform.domain.HostStatusService;
import io.debezium.platform.environment.host.config.HostConfigGroup;
import io.debezium.platform.environment.host.provisioning.HostProvisioner.ProvisionResult;

/**
 * Unit tests for {@link HostProvisioningService}.
 *
 * <p>Plain JUnit 5 tests with no {@code @QuarkusTest}. The {@link HostProvisioner}
 * strategy is mocked directly — no Mockito spy needed. This verifies:
 * <ul>
 *   <li>Status transitions: PENDING → PROVISIONING → READY on successful provision</li>
 *   <li>Status transitions: PENDING → PROVISIONING → FAILED on failed provision</li>
 *   <li>Dedicated thread pool is used (not {@code ForkJoinPool.commonPool()})</li>
 *   <li>Deprovisioning delegates to the provisioner without status changes</li>
 *   <li>Agent token is generated and passed to the provisioner</li>
 * </ul>
 */
class HostProvisioningServiceTest {

    private static final long ASYNC_WAIT_SECONDS = 10;

    private HostStatusService hostStatusService;
    private HostProvisioner provisioner;
    private HostProvisioningService service;

    @BeforeEach
    void setUp() {
        Logger logger = Logger.getLogger(HostProvisioningServiceTest.class);
        hostStatusService = mock(HostStatusService.class);
        provisioner = mock(HostProvisioner.class);

        HostConfigGroup hostConfig = mock(HostConfigGroup.class);
        when(hostConfig.executorPoolSize()).thenReturn(4);
        when(hostConfig.shutdownTimeoutSeconds()).thenReturn(5L);

        service = new HostProvisioningService(logger, hostStatusService, provisioner, hostConfig);
    }

    @AfterEach
    void tearDown() {
        service.onStop(null);
    }

    @Test
    void provisionMarksReadyOnSuccessfulProvisioning() throws Exception {
        when(provisioner.provision(eq("db-server-1"), anyString()))
                .thenReturn(new ProvisionResult.Success("ok=7 changed=3"));

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        })
                .when(hostStatusService).markReady(eq("db-server-1"), anyString());

        service.provision("db-server-1");

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(hostStatusService).markProvisioning("db-server-1");
        verify(hostStatusService).markReady(eq("db-server-1"), anyString());
    }

    @Test
    void provisionGeneratesNonEmptyAgentToken() throws Exception {
        ArgumentCaptor<String> tokenCaptor = ArgumentCaptor.forClass(String.class);

        when(provisioner.provision(eq("db-server-1"), anyString()))
                .thenReturn(new ProvisionResult.Success("ok"));

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        })
                .when(hostStatusService).markReady(eq("db-server-1"), anyString());

        service.provision("db-server-1");
        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();

        verify(provisioner).provision(eq("db-server-1"), tokenCaptor.capture());
        assertThat(tokenCaptor.getValue()).isNotBlank();
    }

    @Test
    void provisionMarksFailedOnProvisionerFailure() throws Exception {
        when(provisioner.provision(eq("db-server-2"), anyString()))
                .thenReturn(new ProvisionResult.Failure("fatal: UNREACHABLE"));

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        })
                .when(hostStatusService).markFailed(eq("db-server-2"), anyString());

        service.provision("db-server-2");

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(hostStatusService).markProvisioning("db-server-2");

        ArgumentCaptor<String> reportCaptor = ArgumentCaptor.forClass(String.class);
        verify(hostStatusService).markFailed(eq("db-server-2"), reportCaptor.capture());
        assertThat(reportCaptor.getValue()).contains("fatal: UNREACHABLE");
    }

    @Test
    void provisionRunsOnDedicatedThreadPool() throws Exception {
        String[] executionThreadName = new String[1];

        doAnswer(invocation -> {
            executionThreadName[0] = Thread.currentThread().getName();
            return null;
        }).when(hostStatusService).markProvisioning(anyString());

        when(provisioner.provision(anyString(), anyString()))
                .thenReturn(new ProvisionResult.Success("ok"));

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        })
                .when(hostStatusService).markReady(anyString(), anyString());

        service.provision("db-server-1");

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        assertThat(executionThreadName[0]).startsWith("debezium-");
        assertThat(executionThreadName[0]).doesNotContain("ForkJoinPool");
    }

    @Test
    void deprovisionDelegatesToProvisioner() throws Exception {
        CountDownLatch latch = new CountDownLatch(1);

        when(provisioner.deprovision("db-server-1"))
                .thenAnswer(inv -> {
                    latch.countDown();
                    return new ProvisionResult.Success("Agent removed");
                });

        service.deprovision("db-server-1");

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(provisioner).deprovision("db-server-1");
    }

    @Test
    void deprovisionRunsOnDedicatedThreadPool() throws Exception {
        String[] executionThreadName = new String[1];

        CountDownLatch latch = new CountDownLatch(1);

        when(provisioner.deprovision("db-server-1"))
                .thenAnswer(inv -> {
                    executionThreadName[0] = Thread.currentThread().getName();
                    latch.countDown();
                    return new ProvisionResult.Success("Agent removed");
                });

        service.deprovision("db-server-1");

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        assertThat(executionThreadName[0]).startsWith("debezium-");
    }
}
