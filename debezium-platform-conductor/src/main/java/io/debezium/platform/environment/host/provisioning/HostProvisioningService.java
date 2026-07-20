/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import io.debezium.platform.domain.HostStatusService;
import io.quarkus.runtime.ShutdownEvent;

/**
 * Executes Ansible playbooks to provision and deprovision remote hosts
 * for pipeline deployment.
 *
 * <p>Each provisioning or deprovisioning run is submitted to a dedicated
 * fixed-size thread pool ({@value #ANSIBLE_EXECUTOR_POOL_SIZE} threads) to
 * isolate the blocking Ansible process (typically 2–5 minutes) from the
 * Quarkus reactive threads and {@code ForkJoinPool.commonPool()}. Without
 * this isolation, 3 concurrent provisioning runs on a 4-core machine would
 * exhaust the common pool and freeze the entire REST API.
 *
 * <p>Database updates go through {@link HostStatusService}, which extends
 * {@code AbstractService} and uses the Blaze-Persistence entity view layer
 * — the same pattern used by {@code PipelineService}, {@code VaultService},
 * and {@code ConnectionService}.
 *
 * <p>The bearer token for Host Agent authentication is generated in Java
 * <em>before</em> invoking Ansible and passed as an {@code --extra-vars}
 * argument. Only after a successful playbook run (exit code 0) is the token
 * committed to the database, keeping DB and remote-host state from ever
 * observably diverging.
 *
 * @see HostStatusService
 * @see io.debezium.platform.environment.host.discovery.SshConfigWatcherService
 */
@ApplicationScoped
public class HostProvisioningService {

    private static final String ANSIBLE_PLAYBOOK_BINARY = "ansible-playbook";
    private static final String INVENTORY_FLAG = "-i";
    private static final String EXTRA_VARS_FLAG = "--extra-vars";
    private static final String SSH_EXTRA_ARGS_FLAG = "--ssh-extra-args";
    private static final String SSH_CONFIG_FLAG = "-F";
    private static final String AGENT_TOKEN_VAR_PREFIX = "agent_token=";
    private static final String AD_HOC_INVENTORY_SUFFIX = ",";
    private static final String HOME_TILDE = "~";
    private static final String USER_HOME_PROPERTY = "user.home";
    private static final int SUCCESS_EXIT_CODE = 0;
    private static final int ANSIBLE_EXECUTOR_POOL_SIZE = 4;
    private static final long SHUTDOWN_TIMEOUT_SECONDS = 5;
    private static final String ANSIBLE_THREAD_PREFIX = "ansible-provisioner-";
    private static final String TOKEN_REDACTION_MARKER = "[REDACTED]";

    private final Logger logger;
    private final HostStatusService hostStatusService;
    private final ExecutorService ansibleExecutor;

    @ConfigProperty(name = "debezium.host.ansible-playbook-path", defaultValue = "/opt/debezium/ansible/host-setup.yml")
    String playbookPath;

    @ConfigProperty(name = "debezium.host.ansible-teardown-path", defaultValue = "/opt/debezium/ansible/host-teardown.yml")
    String teardownPlaybookPath;

    @ConfigProperty(name = "debezium.host.ansible-timeout-minutes", defaultValue = "30")
    int ansibleTimeoutMinutes;

    @ConfigProperty(name = "debezium.host.ssh-config-path", defaultValue = "~/.ssh/config")
    String sshConfigPathRaw;

    /** Resolved absolute path to the SSH config file, with {@code ~} expanded. */
    String resolvedSshConfigPath;

    public HostProvisioningService(Logger logger, HostStatusService hostStatusService) {
        this.logger = logger;
        this.hostStatusService = hostStatusService;

        AtomicInteger threadCounter = new AtomicInteger(1);
        this.ansibleExecutor = Executors.newFixedThreadPool(ANSIBLE_EXECUTOR_POOL_SIZE, runnable -> {
            Thread thread = new Thread(runnable,
                    ANSIBLE_THREAD_PREFIX + threadCounter.getAndIncrement());
            thread.setDaemon(true);
            return thread;
        });
    }

    /**
     * Resolves the {@code ~} in the SSH config path to the actual home directory.
     * Uses the same resolution strategy as {@code SshConfigWatcherService}.
     */
    String resolveSshConfigPath() {
        if (resolvedSshConfigPath == null) {
            resolvedSshConfigPath = Path.of(
                    sshConfigPathRaw.replace(HOME_TILDE, System.getProperty(USER_HOME_PROPERTY)))
                    .toAbsolutePath().toString();
        }
        return resolvedSshConfigPath;
    }

    /**
     * Graceful shutdown of the Ansible executor pool, mirroring the
     * shutdown discipline in {@code SshConfigWatcherService.onStop()}.
     */
    void onStop(@Observes ShutdownEvent ev) {
        ansibleExecutor.shutdown();
        try {
            if (!ansibleExecutor.awaitTermination(SHUTDOWN_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                ansibleExecutor.shutdownNow();
            }
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Triggers Ansible provisioning for the given SSH host alias.
     *
     * <p>Sets {@code HostStatusEntity} status:
     * PENDING → PROVISIONING → READY or FAILED.
     *
     * <p>The actual Ansible run is submitted to the dedicated executor pool
     * so this method returns immediately without blocking the caller.
     *
     * @param sshAlias the SSH config alias identifying the target host
     */
    public void provision(String sshAlias) {
        ansibleExecutor.submit(() -> executeProvisioningPlaybook(sshAlias));
    }

    /**
     * Triggers Ansible deprovisioning (agent removal and cleanup) for the given host.
     *
     * <p>Runs the teardown playbook to stop and remove the Host Agent systemd
     * service from the remote host. Submitted to the same dedicated executor pool.
     *
     * @param sshAlias the SSH config alias identifying the target host
     */
    public void deprovision(String sshAlias) {
        ansibleExecutor.submit(() -> executeDeprovisioningPlaybook(sshAlias));
    }

    /**
     * Executes the provisioning playbook for a single host.
     *
     * <p>Token is generated before the Ansible run and passed via
     * {@code --extra-vars}. Only committed to DB after exit code 0.
     */
    private void executeProvisioningPlaybook(String sshAlias) {
        String agentToken = UUID.randomUUID().toString();
        List<String> command = buildProvisionCommand(sshAlias, agentToken);

        hostStatusService.markProvisioning(sshAlias);
        logger.infov("Starting Ansible provisioning for host {0}", sshAlias);

        AnsibleExecutionResult result = runAnsibleProcess(command, agentToken);

        switch (result) {
            case AnsibleExecutionResult.Success success ->
                hostStatusService.markReady(sshAlias, agentToken);

            case AnsibleExecutionResult.Failure failure ->
                hostStatusService.markFailed(sshAlias, failure.report());
        }
    }

    /**
     * Executes the teardown playbook to remove the Host Agent from a host.
     * Does not change provisioning status — the caller is responsible for
     * marking the host as REMOVED via {@code HostStatusService.markHostRemoved()}.
     */
    private void executeDeprovisioningPlaybook(String sshAlias) {
        List<String> command = buildDeprovisionCommand(sshAlias);

        logger.infov("Starting Ansible deprovisioning for host {0}", sshAlias);

        AnsibleExecutionResult result = runAnsibleProcess(command, null);

        switch (result) {
            case AnsibleExecutionResult.Success ignored ->
                logger.infov("Host {0} deprovisioned successfully", sshAlias);

            case AnsibleExecutionResult.Failure failure ->
                logger.errorv("Deprovisioning failed for host {0}: {1}",
                        sshAlias, failure.report());
        }
    }

    /**
     * Runs an Ansible playbook as an OS process, draining stdout/stderr
     * continuously to prevent pipe-buffer deadlock.
     *
     * <p>{@code redirectErrorStream(true)} merges stderr into stdout so a
     * single reader thread captures all output. The reader runs on a
     * separate thread that drains the stream <em>while</em> the process
     * is still running — calling {@code waitFor()} before draining risks
     * hanging the process once the OS pipe buffer fills (typically 64 KB).
     *
     * @param command        the full command array for ProcessBuilder
     * @param tokenToRedact  bearer token to scrub from captured output
     *                       (null if no redaction needed)
     * @return success or failure with captured (redacted) output
     */
    private AnsibleExecutionResult runAnsibleProcess(List<String> command,
                                                     String tokenToRedact) {
        Process process = null;
        try {
            process = launchProcess(command);

            AnsibleOutputDrainer drainer = new AnsibleOutputDrainer(process, tokenToRedact);
            Thread drainerThread = new Thread(drainer, "ansible-output-drainer");
            drainerThread.setDaemon(true);
            drainerThread.start();

            boolean finished = process.waitFor(ansibleTimeoutMinutes, TimeUnit.MINUTES);

            drainerThread.join(TimeUnit.SECONDS.toMillis(SHUTDOWN_TIMEOUT_SECONDS));
            String output = drainer.getOutput();

            if (!finished) {
                process.destroyForcibly();
                String timeoutReport = "Ansible process timed out after "
                        + ansibleTimeoutMinutes + " minutes\n" + output;
                logger.errorv("Ansible process timed out for command: {0}", command);
                return new AnsibleExecutionResult.Failure(timeoutReport);
            }

            int exitCode = process.exitValue();

            if (exitCode == SUCCESS_EXIT_CODE) {
                return new AnsibleExecutionResult.Success(output);
            }

            logger.errorv("Ansible process exited with code {0}", exitCode);
            return new AnsibleExecutionResult.Failure(output);
        }
        catch (IOException e) {
            String startFailureReport = "Failed to start Ansible process: " + e.getMessage();
            logger.errorv(e, "Failed to start Ansible process");
            return new AnsibleExecutionResult.Failure(startFailureReport);
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            if (process != null) {
                process.destroyForcibly();
            }
            return new AnsibleExecutionResult.Failure("Ansible execution interrupted");
        }
    }

    /**
     * Builds the command array for the provisioning playbook.
     *
     * <p>The trailing comma in the inventory string is required by Ansible
     * for single-host ad-hoc inventory — without it, Ansible interprets
     * the argument as a file path rather than a host pattern.
     *
     * <p>The {@code --ssh-extra-args "-F <path>"} flag explicitly tells
     * Ansible's underlying SSH to use the same config file that the
     * {@code SshConfigWatcherService} reads. This ensures both components
     * always use the same file, even if the admin overrides the default
     * {@code ~/.ssh/config} via the {@code debezium.host.ssh-config-path}
     * property.
     *
     * @param sshAlias   the SSH config alias (e.g., {@code db-server-1})
     * @param agentToken the bearer token to pass as an Ansible extra-var
     * @return the command array for ProcessBuilder
     */
    List<String> buildProvisionCommand(String sshAlias, String agentToken) {
        String adHocInventory = sshAlias + AD_HOC_INVENTORY_SUFFIX;
        String tokenVar = AGENT_TOKEN_VAR_PREFIX + agentToken;
        String sshArgs = SSH_CONFIG_FLAG + " " + resolveSshConfigPath();
        return List.of(ANSIBLE_PLAYBOOK_BINARY, playbookPath,
                INVENTORY_FLAG, adHocInventory,
                SSH_EXTRA_ARGS_FLAG, sshArgs,
                EXTRA_VARS_FLAG, tokenVar);
    }

    /**
     * Builds the command array for the deprovisioning (teardown) playbook.
     *
     * @param sshAlias the SSH config alias
     * @return the command array for ProcessBuilder
     */
    List<String> buildDeprovisionCommand(String sshAlias) {
        String adHocInventory = sshAlias + AD_HOC_INVENTORY_SUFFIX;
        String sshArgs = SSH_CONFIG_FLAG + " " + resolveSshConfigPath();
        return List.of(ANSIBLE_PLAYBOOK_BINARY, teardownPlaybookPath,
                INVENTORY_FLAG, adHocInventory,
                SSH_EXTRA_ARGS_FLAG, sshArgs);
    }

    /**
     * Launches an OS process for the given command. Package-visible to
     * allow test overrides via Mockito spy without requiring a separate
     * interface or CDI producer.
     */
    Process launchProcess(List<String> command) throws IOException {
        return new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();
    }

    /**
     * Sealed result type for Ansible execution, replacing boolean/null
     * error-channel ambiguity with explicit success/failure variants.
     */
    sealed interface AnsibleExecutionResult {
        record Success(String output) implements AnsibleExecutionResult {
        }

        record Failure(String report) implements AnsibleExecutionResult {
        }
    }

    /**
     * Drains a process's merged stdout+stderr stream line-by-line,
     * redacting any occurrence of the bearer token from the captured output.
     *
     * <p>Runs on a dedicated thread started before {@code process.waitFor()}
     * to prevent the OS pipe buffer (typically 64 KB) from filling up and
     * blocking the Ansible process.
     */
    private static final class AnsibleOutputDrainer implements Runnable {

        private final Process process;
        private final String tokenToRedact;
        private final StringBuilder outputBuilder = new StringBuilder();

        AnsibleOutputDrainer(Process process, String tokenToRedact) {
            this.process = process;
            this.tokenToRedact = tokenToRedact;
        }

        @Override
        public void run() {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    String sanitized = redactToken(line);
                    outputBuilder.append(sanitized).append('\n');
                }
            }
            catch (IOException e) {
                outputBuilder.append("[Error reading Ansible output: ")
                        .append(e.getMessage()).append("]\n");
            }
        }

        private String redactToken(String line) {
            if (tokenToRedact != null && line.contains(tokenToRedact)) {
                return line.replace(tokenToRedact, TOKEN_REDACTION_MARKER);
            }
            return line;
        }

        String getOutput() {
            return outputBuilder.toString();
        }
    }
}
