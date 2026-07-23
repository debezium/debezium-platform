/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.debezium.platform.environment.host.config.HostConfigGroup;
import io.debezium.platform.environment.host.provisioning.HostProvisioner.ProvisionResult;

/**
 * Unit tests for {@link AnsibleHostProvisioner}.
 *
 * <p>Plain JUnit 5 tests with no {@code @QuarkusTest}. The process-launch
 * seam ({@code launchProcess()}) is overridden via Mockito spy. This verifies:
 * <ul>
 *   <li>Command construction correctness (trailing comma, extra-vars, SSH args)</li>
 *   <li>Bearer token redaction from captured Ansible output</li>
 *   <li>ProcessBuilder.start() IOException handling</li>
 *   <li>Timeout handling via destroyForcibly()</li>
 *   <li>Success/failure result based on exit code</li>
 * </ul>
 */
class AnsibleHostProvisionerTest {

    private AnsibleHostProvisioner provisioner;

    @BeforeEach
    void setUp() {
        Logger logger = Logger.getLogger(AnsibleHostProvisionerTest.class);

        HostConfigGroup hostConfig = mock(HostConfigGroup.class);
        when(hostConfig.ansiblePlaybookPath()).thenReturn("/opt/debezium/ansible/host-setup.yml");
        when(hostConfig.ansibleTeardownPath()).thenReturn("/opt/debezium/ansible/host-teardown.yml");
        when(hostConfig.ansibleTimeoutMinutes()).thenReturn(30);
        when(hostConfig.sshConfigPath()).thenReturn("/etc/ssh/test-config");

        provisioner = spy(new AnsibleHostProvisioner(logger, hostConfig));
    }

    @Test
    void buildProvisionCommandProducesCorrectArray() {
        List<String> command = provisioner.buildProvisionCommand("db-server-1", "test-token-abc");

        assertThat(command).containsExactly(
                "ansible-playbook",
                "/opt/debezium/ansible/host-setup.yml",
                "-i", "db-server-1,",
                "--ssh-extra-args", "-F /etc/ssh/test-config",
                "--extra-vars", "agent_token=test-token-abc");
    }

    @Test
    void buildProvisionCommandIncludesTrailingComma() {
        List<String> command = provisioner.buildProvisionCommand("my-host", "token-123");

        assertThat(command.get(3)).endsWith(",");
    }

    @Test
    void buildDeprovisionCommandProducesCorrectArray() {
        List<String> command = provisioner.buildDeprovisionCommand("db-server-2");

        assertThat(command).containsExactly(
                "ansible-playbook",
                "/opt/debezium/ansible/host-teardown.yml",
                "-i", "db-server-2,",
                "--ssh-extra-args", "-F /etc/ssh/test-config");
    }

    @Test
    void provisionReturnsSuccessOnExitCodeZero() throws Exception {
        Process mockProcess = createMockProcess("PLAY RECAP: ok=7 changed=3", 0);
        doReturn(mockProcess).when(provisioner).launchProcess(any());

        ProvisionResult result = provisioner.provision("db-server-1", "test-token");

        assertThat(result).isInstanceOf(ProvisionResult.Success.class);
        ProvisionResult.Success success = (ProvisionResult.Success) result;
        assertThat(success.output()).contains("PLAY RECAP");
    }

    @Test
    void provisionReturnsFailureOnNonZeroExitCode() throws Exception {
        Process mockProcess = createMockProcess("fatal: UNREACHABLE", 1);
        doReturn(mockProcess).when(provisioner).launchProcess(any());

        ProvisionResult result = provisioner.provision("db-server-2", "test-token");

        assertThat(result).isInstanceOf(ProvisionResult.Failure.class);
        ProvisionResult.Failure failure = (ProvisionResult.Failure) result;
        assertThat(failure.report()).contains("fatal: UNREACHABLE");
    }

    @Test
    void provisionReturnsFailureWhenProcessCannotStart() throws Exception {
        doThrow(new IOException("Cannot run program: ansible-playbook"))
                .when(provisioner).launchProcess(any());

        ProvisionResult result = provisioner.provision("db-server-3", "test-token");

        assertThat(result).isInstanceOf(ProvisionResult.Failure.class);
        ProvisionResult.Failure failure = (ProvisionResult.Failure) result;
        assertThat(failure.report()).contains("Failed to start Ansible process");
    }

    @Test
    void provisionReturnsFailureOnTimeout() throws Exception {
        Process mockProcess = mock(Process.class);
        when(mockProcess.getInputStream()).thenReturn(
                inputStreamOf("Running long task..."));
        when(mockProcess.waitFor(30, TimeUnit.MINUTES)).thenReturn(false);
        doReturn(mockProcess).when(provisioner).launchProcess(any());

        ProvisionResult result = provisioner.provision("db-server-4", "test-token");

        verify(mockProcess).destroyForcibly();
        assertThat(result).isInstanceOf(ProvisionResult.Failure.class);
        ProvisionResult.Failure failure = (ProvisionResult.Failure) result;
        assertThat(failure.report()).contains("timed out after 30 minutes");
    }

    @Test
    void provisionRedactsTokenFromOutput() throws Exception {
        String token = "secret-token-xyz";
        Process mockProcess = createMockProcess(
                "TASK [deploy agent] token=" + token + " deployed to host", 1);
        doReturn(mockProcess).when(provisioner).launchProcess(any());

        ProvisionResult result = provisioner.provision("db-server-5", token);

        assertThat(result).isInstanceOf(ProvisionResult.Failure.class);
        ProvisionResult.Failure failure = (ProvisionResult.Failure) result;
        assertThat(failure.report()).contains("[REDACTED]");
        assertThat(failure.report()).doesNotContain(token);
    }

    @Test
    void deprovisionReturnsSuccessOnExitCodeZero() throws Exception {
        Process mockProcess = createMockProcess("Agent removed", 0);
        doReturn(mockProcess).when(provisioner).launchProcess(any());

        ProvisionResult result = provisioner.deprovision("db-server-1");

        assertThat(result).isInstanceOf(ProvisionResult.Success.class);
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
