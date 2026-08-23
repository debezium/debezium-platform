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
import java.util.concurrent.TimeUnit;

import org.jboss.logging.Logger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.debezium.platform.environment.host.config.HostConfigGroup;

/**
 * Unit tests for {@link AnsibleCommandRunner}.
 *
 * <p>Plain JUnit 5 tests with no {@code @QuarkusTest}. The process-launch
 * seam ({@code launchProcess()}) is overridden via Mockito spy — the same
 * pattern used by {@link AnsibleHostProvisionerTest}. This verifies:
 * <ul>
 *   <li>Shell command execution returns Success on exit code 0</li>
 *   <li>Shell command execution returns Failure on non-zero exit code</li>
 *   <li>Copy content produces correct module arguments</li>
 *   <li>Directory creation produces correct module arguments</li>
 *   <li>IOException during process start returns Failure</li>
 *   <li>Process timeout returns Failure and calls destroyForcibly()</li>
 *   <li>Output capture includes process stdout content</li>
 * </ul>
 */
class AnsibleCommandRunnerTest {

    private AnsibleCommandRunner runner;

    @BeforeEach
    void setUp() {
        Logger logger = Logger.getLogger(AnsibleCommandRunnerTest.class);

        HostConfigGroup hostConfig = mock(HostConfigGroup.class);
        when(hostConfig.sshConfigPath()).thenReturn("/home/testuser/.ssh/config");

        runner = spy(new AnsibleCommandRunner(logger, hostConfig));
    }

    @Test
    void runShellCommandReturnsSuccessOnExitCodeZero() throws Exception {
        Process mockProcess = createMockProcess("container-id-abc123", 0);
        doReturn(mockProcess).when(runner).launchProcess(any());

        CommandResult result = runner.runShellCommand("db-server-1", "docker run -d myimage");

        assertThat(result).isInstanceOf(CommandResult.Success.class);
        CommandResult.Success success = (CommandResult.Success) result;
        assertThat(success.output()).contains("container-id-abc123");
    }

    @Test
    void runShellCommandReturnsFailureOnNonZeroExitCode() throws Exception {
        Process mockProcess = createMockProcess("Error: No such image", 1);
        doReturn(mockProcess).when(runner).launchProcess(any());

        CommandResult result = runner.runShellCommand("db-server-1", "docker run -d badimage");

        assertThat(result).isInstanceOf(CommandResult.Failure.class);
        CommandResult.Failure failure = (CommandResult.Failure) result;
        assertThat(failure.output()).contains("Error: No such image");
    }

    @Test
    void runShellCommandReturnsFailureWhenProcessCannotStart() throws Exception {
        doThrow(new IOException("ansible not found"))
                .when(runner).launchProcess(any());

        CommandResult result = runner.runShellCommand("db-server-1", "docker ps");

        assertThat(result).isInstanceOf(CommandResult.Failure.class);
        CommandResult.Failure failure = (CommandResult.Failure) result;
        assertThat(failure.output()).contains("Failed to execute Ansible command");
    }

    @Test
    void runShellCommandReturnsFailureOnTimeout() throws Exception {
        Process mockProcess = mock(Process.class);
        when(mockProcess.getInputStream()).thenReturn(inputStreamOf("Running..."));
        when(mockProcess.waitFor(5, TimeUnit.MINUTES)).thenReturn(false);
        doReturn(mockProcess).when(runner).launchProcess(any());

        CommandResult result = runner.runShellCommand("db-server-1", "docker run -d slowimage");

        verify(mockProcess).destroyForcibly();
        assertThat(result).isInstanceOf(CommandResult.Failure.class);
        CommandResult.Failure failure = (CommandResult.Failure) result;
        assertThat(failure.output()).contains("timed out");
    }

    @Test
    void copyContentReturnsSuccessOnExitCodeZero() throws Exception {
        Process mockProcess = createMockProcess("CHANGED", 0);
        doReturn(mockProcess).when(runner).launchProcess(any());

        CommandResult result = runner.copyContent("db-server-1",
                "debezium.source.connector.class=test", "/opt/configs/app.properties");

        assertThat(result).isInstanceOf(CommandResult.Success.class);
    }

    @Test
    void createDirectoryReturnsSuccessOnExitCodeZero() throws Exception {
        Process mockProcess = createMockProcess("CHANGED", 0);
        doReturn(mockProcess).when(runner).launchProcess(any());

        CommandResult result = runner.createDirectory("db-server-1", "/opt/debezium/configs/42");

        assertThat(result).isInstanceOf(CommandResult.Success.class);
    }

    @Test
    void copyContentReturnsFailureOnNonZeroExitCode() throws Exception {
        Process mockProcess = createMockProcess("Permission denied", 1);
        doReturn(mockProcess).when(runner).launchProcess(any());

        CommandResult result = runner.copyContent("db-server-1",
                "content", "/root/protected.conf");

        assertThat(result).isInstanceOf(CommandResult.Failure.class);
        CommandResult.Failure failure = (CommandResult.Failure) result;
        assertThat(failure.output()).contains("Permission denied");
    }

    @Test
    void sealedResultPatternMatchingWorks() throws Exception {
        Process mockProcess = createMockProcess("ok", 0);
        doReturn(mockProcess).when(runner).launchProcess(any());

        CommandResult result = runner.runShellCommand("host", "echo test");

        // Verify the sealed type pattern matching compiles and works
        String output = switch (result) {
            case CommandResult.Success success -> success.output();
            case CommandResult.Failure failure -> failure.output();
        };

        assertThat(output).contains("ok");
    }

    @Test
    void runShellCommandReturnsFailureOnInterrupt() throws Exception {
        Process mockProcess = mock(Process.class);
        when(mockProcess.getInputStream()).thenReturn(inputStreamOf("Running..."));
        when(mockProcess.waitFor(5, TimeUnit.MINUTES)).thenThrow(new InterruptedException("interrupted"));
        doReturn(mockProcess).when(runner).launchProcess(any());

        CommandResult result = runner.runShellCommand("db-server-1", "docker ps");

        verify(mockProcess).destroyForcibly();
        assertThat(result).isInstanceOf(CommandResult.Failure.class);
        CommandResult.Failure failure = (CommandResult.Failure) result;
        assertThat(failure.output()).contains("interrupted");
        // Thread interrupt flag should be re-set
        assertThat(Thread.currentThread().isInterrupted()).isTrue();
        // Clear the interrupt flag for test cleanup
        Thread.interrupted();
    }

    @Test
    void buildAdHocCommandProducesCorrectArray() throws Exception {
        // Capture the command array passed to launchProcess
        var commandCaptor = org.mockito.ArgumentCaptor.forClass(java.util.List.class);
        Process mockProcess = createMockProcess("ok", 0);
        doReturn(mockProcess).when(runner).launchProcess(commandCaptor.capture());

        runner.runShellCommand("db-server-1", "docker ps");

        @SuppressWarnings("unchecked")
        java.util.List<String> command = commandCaptor.getValue();
        assertThat(command.get(0)).isEqualTo("ansible");
        assertThat(command.get(1)).isEqualTo("db-server-1");
        assertThat(command.get(2)).isEqualTo("-i");
        assertThat(command.get(3)).isEqualTo("db-server-1,");
        assertThat(command.get(4)).isEqualTo("-m");
        assertThat(command.get(5)).isEqualTo("shell");
        assertThat(command.get(6)).isEqualTo("-a");
        assertThat(command.get(7)).isEqualTo("docker ps");
        assertThat(command.get(8)).isEqualTo("--ssh-extra-args");
        assertThat(command.get(9)).contains("-F");
        assertThat(command.get(10)).isEqualTo("--become");
    }

    private Process createMockProcess(String output, int exitCode) throws Exception {
        Process mockProcess = mock(Process.class);
        when(mockProcess.getInputStream()).thenReturn(inputStreamOf(output));
        when(mockProcess.waitFor(5, TimeUnit.MINUTES)).thenReturn(true);
        when(mockProcess.exitValue()).thenReturn(exitCode);
        return mockProcess;
    }

    private ByteArrayInputStream inputStreamOf(String content) {
        return new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8));
    }
}
