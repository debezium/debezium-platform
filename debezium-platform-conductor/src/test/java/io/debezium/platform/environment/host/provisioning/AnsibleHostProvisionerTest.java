/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import io.debezium.platform.environment.host.config.HostConfigGroup;
import io.debezium.platform.environment.host.provisioning.HostProvisioner.ProvisionResult;

/**
 * Unit tests for {@link AnsibleHostProvisioner}.
 *
 * <p>Plain JUnit 5 tests with no {@code @QuarkusTest}. The process-launch
 * seam ({@code launchProcess()}) is overridden via Mockito spy. This verifies:
 * <ul>
 *   <li>Command construction correctness (trailing comma, extra-vars, SSH args)</li>
 *   <li>Playbook path resolution (user-configured vs. classpath fallback)</li>
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
        when(hostConfig.ansiblePlaybookPath()).thenReturn(Optional.empty());
        when(hostConfig.ansibleTeardownPath()).thenReturn(Optional.empty());
        when(hostConfig.ansibleTimeoutMinutes()).thenReturn(30);
        when(hostConfig.sshConfigPath()).thenReturn("/etc/ssh/test-config");

        provisioner = spy(new AnsibleHostProvisioner(logger, hostConfig));
    }

    @Test
    void buildProvisionCommandProducesCorrectArray() {
        List<String> command = provisioner.buildProvisionCommand("db-server-1", "test-token-abc");

        assertThat(command).hasSize(8);
        assertThat(command.get(0)).isEqualTo("ansible-playbook");
        assertThat(command.get(1)).endsWith("host-setup.yml");
        assertThat(command.get(2)).isEqualTo("-i");
        assertThat(command.get(3)).isEqualTo("db-server-1,");
        assertThat(command.get(4)).isEqualTo("--ssh-extra-args");
        assertThat(command.get(5)).isEqualTo("-F /etc/ssh/test-config");
        assertThat(command.get(6)).isEqualTo("--extra-vars");
        assertThat(command.get(7)).isEqualTo("agent_token=test-token-abc");
    }

    @Test
    void buildProvisionCommandIncludesTrailingComma() {
        List<String> command = provisioner.buildProvisionCommand("my-host", "token-123");

        assertThat(command.get(3)).endsWith(",");
    }

    @Test
    void buildDeprovisionCommandProducesCorrectArray() {
        List<String> command = provisioner.buildDeprovisionCommand("db-server-2");

        assertThat(command).hasSize(6);
        assertThat(command.get(0)).isEqualTo("ansible-playbook");
        assertThat(command.get(1)).endsWith("host-teardown.yml");
        assertThat(command.get(2)).isEqualTo("-i");
        assertThat(command.get(3)).isEqualTo("db-server-2,");
        assertThat(command.get(4)).isEqualTo("--ssh-extra-args");
        assertThat(command.get(5)).isEqualTo("-F /etc/ssh/test-config");
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

    // --- resolvePlaybookPath tests ---

    @Test
    void resolvePlaybookPathUsesCustomPathWhenFileExists(@TempDir Path tempDir) throws Exception {
        Path customPlaybook = tempDir.resolve("my-custom-setup.yml");
        Files.writeString(customPlaybook, "---\n- hosts: all\n");

        String resolved = provisioner.resolvePlaybookPath(
                Optional.of(customPlaybook.toString()),
                AnsibleHostProvisioner.SETUP_RESOURCE);

        assertThat(resolved).isEqualTo(customPlaybook.toAbsolutePath().toString());
    }

    @Test
    void resolvePlaybookPathFallsBackToClasspathWhenCustomPathMissing() {
        String resolved = provisioner.resolvePlaybookPath(
                Optional.of("/nonexistent/path/playbook.yml"),
                AnsibleHostProvisioner.SETUP_RESOURCE);

        // Should fall back to the classpath resource, which ends with the resource name
        assertThat(resolved).endsWith("host-setup.yml");
    }

    @Test
    void resolvePlaybookPathFallsBackToClasspathWhenOptionalEmpty() {
        String resolved = provisioner.resolvePlaybookPath(
                Optional.empty(),
                AnsibleHostProvisioner.SETUP_RESOURCE);

        assertThat(resolved).endsWith("host-setup.yml");
    }

    @Test
    void resolvePlaybookPathThrowsWhenNeitherConfiguredNorOnClasspath() {
        assertThatThrownBy(() -> provisioner.resolvePlaybookPath(
                Optional.empty(),
                "nonexistent/playbook.yml"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("neither configured nor available on classpath");
    }

    @Test
    void resolvePlaybookPathResolvesToClasspathForTeardown() {
        String resolved = provisioner.resolvePlaybookPath(
                Optional.empty(),
                AnsibleHostProvisioner.TEARDOWN_RESOURCE);

        assertThat(resolved).endsWith("host-teardown.yml");
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
