/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;

/**
 * Integration test that executes the real {@code host-setup.yml} Ansible
 * playbook against {@code localhost} using the {@code local} connection
 * plugin (no SSH).
 *
 * <p>This test validates that:
 * <ul>
 *   <li>The playbook YAML is syntactically correct and all variables resolve</li>
 *   <li>The playbook runs to completion without errors</li>
 *   <li>The playbook is idempotent (second run reports {@code changed=0})</li>
 * </ul>
 *
 * <p>The test is restricted to Linux ({@code @EnabledOnOs(OS.LINUX)}) because
 * the playbook uses {@code apt}/{@code dnf} and {@code systemd}, which are
 * not available on macOS or Windows. It also requires {@code ansible-playbook}
 * to be installed — if missing, the test is skipped via
 * {@link org.junit.jupiter.api.Assumptions#assumeTrue}.
 *
 * <p>On the GitHub Actions {@code ubuntu-latest} runner, Docker is already
 * pre-installed, so the "Install Docker" tasks will safely report
 * {@code ok} (already present) rather than truly installing. The manual VM
 * test covers the real fresh-installation path.
 *
 * <p>Host Agent tasks are skipped via {@code --skip-tags host_agent} because
 * the Host Agent binary does not exist yet.
 *
 * @see AnsibleHostProvisionerTest
 * @see HostProvisioningServiceTest
 */
@EnabledOnOs(OS.LINUX)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class HostSetupPlaybookIT {

    /** Path to the real playbook under src/main/resources/ansible/. */
    private static final Path PLAYBOOK_PATH = Paths.get("src/main/resources/ansible/host-setup.yml");

    /** Path to the smoke-test playbook under src/test/resources/ansible/. */
    private static final Path SMOKE_TEST_PATH = Paths.get("src/test/resources/ansible/smoke-test.yml");

    @BeforeAll
    static void checkAnsibleAvailable() {
        // Skip the entire test class if ansible-playbook is not installed.
        // On the developer's local machine (even Linux), Ansible might not
        // be present. On CI, action.yml installs it before tests run.
        boolean ansiblePresent = false;
        try {
            Process check = new ProcessBuilder("ansible-playbook", "--version")
                    .redirectErrorStream(true)
                    .start();
            ansiblePresent = check.waitFor(10, TimeUnit.SECONDS) && check.exitValue() == 0;
        }
        catch (Exception ignored) {
            // ansible-playbook not found
        }
        assumeTrue(ansiblePresent, "ansible-playbook is not installed — skipping playbook IT");
    }

    /**
     * Runs the smoke-test playbook to verify Ansible can execute basic
     * commands in this environment.
     * if the real playbook fails due to environment constraints, this smaller
     * test still proves our Java→Ansible integration works.
     */
    @Test
    @Order(1)
    void smokeTestPlaybookExecutesSuccessfully() throws Exception {
        assumeTrue(Files.exists(SMOKE_TEST_PATH),
                "Smoke test playbook not found at " + SMOKE_TEST_PATH);

        List<String> command = List.of(
                "ansible-playbook",
                SMOKE_TEST_PATH.toString(),
                "-i", "localhost,",
                "-c", "local");

        String output = runCommand(command);

        assertThat(output)
                .as("Smoke test should complete successfully")
                .contains("PLAY RECAP");
    }

    /**
     * Executes the real {@code host-setup.yml} playbook against localhost.
     * Verifies exit code 0 (all tasks succeeded).
     */
    @Test
    @Order(2)
    void hostSetupPlaybookRunsSuccessfully() throws Exception {
        assumeTrue(Files.exists(PLAYBOOK_PATH),
                "Playbook not found at " + PLAYBOOK_PATH);

        String output = runRealPlaybook();

        assertThat(output)
                .as("Playbook should reach PLAY RECAP. Full output:\n%s", output)
                .contains("PLAY RECAP");

        // Verify no tasks failed — the PLAY RECAP line shows failed=0
        assertThat(output)
                .as("No tasks should have failed. Full output:\n%s", output)
                .containsPattern("failed=0");
    }

    /**
     * Runs the real playbook a second time to prove idempotency.
     * Every task should report "ok" (no changes), confirming the playbook's
     * header comment: "Safe to re-run".
     */
    @Test
    @Order(3)
    void hostSetupPlaybookIsIdempotent() throws Exception {
        assumeTrue(Files.exists(PLAYBOOK_PATH),
                "Playbook not found at " + PLAYBOOK_PATH);

        String output = runRealPlaybook();

        assertThat(output)
                .as("Second run should report zero changes (idempotent). Output:\n%s", output)
                .contains("changed=0");
    }

    /**
     * Runs the real host-setup.yml playbook against localhost.
     * Uses {@code -c local} to skip SSH, and {@code --skip-tags host_agent}
     * to skip Host Agent tasks (binary not available yet).
     */
    private String runRealPlaybook() throws Exception {
        List<String> command = List.of(
                "ansible-playbook",
                PLAYBOOK_PATH.toString(),
                "-i", "localhost,",
                "-c", "local",
                "--skip-tags", "host_agent",
                "--extra-vars", "agent_token=it-test-token");

        return runCommand(command);
    }

    /**
     * Runs a command using ProcessBuilder and returns stdout+stderr as a string.
     * Fails the test if the process does not exit with code 0.
     */
    private String runCommand(List<String> command) throws Exception {
        Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();

        String output;
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            output = reader.lines().collect(Collectors.joining("\n"));
        }

        boolean finished = process.waitFor(10, TimeUnit.MINUTES);

        assertThat(finished)
                .as("Process should complete within 10 minutes")
                .isTrue();
        assertThat(process.exitValue())
                .as("Process should exit with code 0. Output:\n%s", output)
                .isZero();

        return output;
    }
}
