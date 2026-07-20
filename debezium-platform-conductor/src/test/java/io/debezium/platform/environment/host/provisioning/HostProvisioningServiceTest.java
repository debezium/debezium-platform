/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import io.debezium.platform.domain.HostStatusService;

/**
 * Unit tests for {@link HostProvisioningService}.
 *
 * <p>Plain JUnit 5 tests with no {@code @QuarkusTest} — the process-launch
 * seam ({@code launchProcess()}) is overridden via Mockito spy, and the
 * {@link HostStatusService} is mocked. This verifies:
 * <ul>
 *   <li>Status transitions: PENDING → PROVISIONING → READY on exit code 0</li>
 *   <li>Status transitions: PENDING → PROVISIONING → FAILED on exit code ≠ 0</li>
 *   <li>Dedicated thread pool is used (not {@code ForkJoinPool.commonPool()})</li>
 *   <li>Command construction correctness (trailing comma, extra-vars)</li>
 *   <li>Bearer token redaction from captured Ansible output</li>
 *   <li>ProcessBuilder.start() IOException handling</li>
 *   <li>Timeout handling via destroyForcibly()</li>
 * </ul>
 */
class HostProvisioningServiceTest {

    private static final long ASYNC_WAIT_SECONDS = 10;

    private HostStatusService hostStatusService;
    private HostProvisioningService service;

    @BeforeEach
    void setUp() {
        Logger logger = Logger.getLogger(HostProvisioningServiceTest.class);
        hostStatusService = mock(HostStatusService.class);

        service = spy(new HostProvisioningService(logger, hostStatusService));
        service.playbookPath = "/opt/debezium/ansible/host-setup.yml";
        service.teardownPlaybookPath = "/opt/debezium/ansible/host-teardown.yml";
        service.ansibleTimeoutMinutes = 30;
        service.sshConfigPathRaw = "/etc/ssh/test-config";
        service.resolvedSshConfigPath = null;
    }

    @AfterEach
    void tearDown() {
        service.onStop(null);
    }

    @Test
    void buildProvisionCommandProducesCorrectArray() {
        List<String> command = service.buildProvisionCommand("db-server-1", "test-token-abc");

        assertThat(command).containsExactly(
                "ansible-playbook",
                "/opt/debezium/ansible/host-setup.yml",
                "-i", "db-server-1,",
                "--ssh-extra-args", "-F /etc/ssh/test-config",
                "--extra-vars", "agent_token=test-token-abc");
    }

    @Test
    void buildProvisionCommandIncludesTrailingComma() {
        List<String> command = service.buildProvisionCommand("my-host", "token-123");

        assertThat(command.get(3)).endsWith(",");
    }

    @Test
    void buildDeprovisionCommandProducesCorrectArray() {
        List<String> command = service.buildDeprovisionCommand("db-server-2");

        assertThat(command).containsExactly(
                "ansible-playbook",
                "/opt/debezium/ansible/host-teardown.yml",
                "-i", "db-server-2,",
                "--ssh-extra-args", "-F /etc/ssh/test-config");
    }

    @Test
    void provisionMarksReadyOnSuccessfulAnsibleRun() throws Exception {
        Process mockProcess = createMockProcess("PLAY RECAP: ok=7 changed=3", 0);
        doReturn(mockProcess).when(service).launchProcess(any());

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
        Process mockProcess = createMockProcess("ok", 0);
        doReturn(mockProcess).when(service).launchProcess(any());

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        })
                .when(hostStatusService).markReady(eq("db-server-1"), anyString());

        service.provision("db-server-1");
        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();

        ArgumentCaptor<String> tokenCaptor = ArgumentCaptor.forClass(String.class);
        verify(hostStatusService).markReady(eq("db-server-1"), tokenCaptor.capture());
        assertThat(tokenCaptor.getValue()).isNotBlank();
    }

    @Test
    void provisionMarksFailedOnNonZeroExitCode() throws Exception {
        Process mockProcess = createMockProcess("fatal: UNREACHABLE", 1);
        doReturn(mockProcess).when(service).launchProcess(any());

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
    void provisionMarksFailedWhenProcessCannotStart() throws Exception {
        doReturn(null).when(service).launchProcess(any());
        when(service.launchProcess(any()))
                .thenThrow(new IOException("Cannot run program: ansible-playbook"));

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        })
                .when(hostStatusService).markFailed(eq("db-server-3"), anyString());

        service.provision("db-server-3");

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(hostStatusService).markProvisioning("db-server-3");

        ArgumentCaptor<String> reportCaptor = ArgumentCaptor.forClass(String.class);
        verify(hostStatusService).markFailed(eq("db-server-3"), reportCaptor.capture());
        assertThat(reportCaptor.getValue()).contains("Failed to start Ansible process");
    }

    @Test
    void provisionMarksFailedOnTimeout() throws Exception {
        Process mockProcess = mock(Process.class);
        when(mockProcess.getInputStream()).thenReturn(
                inputStreamOf("Running long task..."));
        when(mockProcess.waitFor(30, TimeUnit.MINUTES)).thenReturn(false);
        doReturn(mockProcess).when(service).launchProcess(any());

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        })
                .when(hostStatusService).markFailed(eq("db-server-4"), anyString());

        service.provision("db-server-4");

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        verify(mockProcess).destroyForcibly();

        ArgumentCaptor<String> reportCaptor = ArgumentCaptor.forClass(String.class);
        verify(hostStatusService).markFailed(eq("db-server-4"), reportCaptor.capture());
        assertThat(reportCaptor.getValue()).contains("timed out after 30 minutes");
    }

    @Test
    void provisionRedactsTokenFromFailureReport() throws Exception {
        // The mock process launch captures the actual command to extract the token
        doAnswer(invocation -> {
            List<String> cmd = invocation.getArgument(0);
            String extraVars = cmd.get(7);
            String token = extraVars.replace("agent_token=", "");
            String output = "TASK [deploy agent] token=" + token + " deployed to host";
            return createMockProcess(output, 1);
        }).when(service).launchProcess(any());

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        })
                .when(hostStatusService).markFailed(eq("db-server-5"), anyString());

        service.provision("db-server-5");

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();

        ArgumentCaptor<String> reportCaptor = ArgumentCaptor.forClass(String.class);
        verify(hostStatusService).markFailed(eq("db-server-5"), reportCaptor.capture());

        String report = reportCaptor.getValue();
        assertThat(report).contains("[REDACTED]");
        assertThat(report).doesNotContain("agent_token=");
    }

    @Test
    void provisionRunsOnDedicatedThreadPool() throws Exception {
        String[] executionThreadName = new String[1];

        doAnswer(invocation -> {
            executionThreadName[0] = Thread.currentThread().getName();
            return null;
        }).when(hostStatusService).markProvisioning(anyString());

        Process mockProcess = createMockProcess("ok", 0);
        doReturn(mockProcess).when(service).launchProcess(any());

        CountDownLatch latch = new CountDownLatch(1);
        doAnswer(inv -> {
            latch.countDown();
            return null;
        })
                .when(hostStatusService).markReady(anyString(), anyString());

        service.provision("db-server-1");

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        assertThat(executionThreadName[0]).startsWith("ansible-provisioner-");
        assertThat(executionThreadName[0]).doesNotContain("ForkJoinPool");
    }

    @Test
    void deprovisionRunsOnDedicatedThreadPool() throws Exception {
        Process mockProcess = createMockProcess("Agent removed", 0);
        doReturn(mockProcess).when(service).launchProcess(any());

        String[] executionThreadName = new String[1];
        CountDownLatch latch = new CountDownLatch(1);

        doAnswer(invocation -> {
            executionThreadName[0] = Thread.currentThread().getName();
            latch.countDown();
            return mockProcess;
        }).when(service).launchProcess(any());

        service.deprovision("db-server-1");

        assertThat(latch.await(ASYNC_WAIT_SECONDS, TimeUnit.SECONDS)).isTrue();
        assertThat(executionThreadName[0]).startsWith("ansible-provisioner-");
    }

    private Process createMockProcess(String output, int exitCode) throws Exception {
        Process mockProcess = mock(Process.class);
        when(mockProcess.getInputStream()).thenReturn(inputStreamOf(output));
        when(mockProcess.waitFor(30, TimeUnit.MINUTES)).thenReturn(true);
        when(mockProcess.exitValue()).thenReturn(exitCode);
        return mockProcess;
    }

    private ByteArrayInputStream inputStreamOf(String content) {
        return new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8));
    }
}
