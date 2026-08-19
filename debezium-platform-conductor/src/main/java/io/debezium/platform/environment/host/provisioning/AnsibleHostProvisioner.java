/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

import java.io.BufferedReader;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

import io.debezium.platform.environment.host.config.HostConfigGroup;

/**
 * Ansible-based implementation of {@link HostProvisioner}.
 *
 * <p>Builds {@code ansible-playbook} command arrays and executes them as
 * OS processes via {@link ProcessBuilder}. A dedicated
 * {@link AnsibleOutputDrainer} thread continuously reads stdout/stderr
 * to prevent the OS pipe buffer (typically 64 KB) from filling and
 * deadlocking the process.
 *
 * <p>Bearer tokens are redacted from captured output before returning
 * the result, preventing accidental exposure in logs or database reports.
 *
 * @see HostProvisioner
 * @see HostProvisioningService
 */
@ApplicationScoped
public class AnsibleHostProvisioner implements HostProvisioner {

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
    private static final long DRAINER_JOIN_TIMEOUT_SECONDS = 5;
    private static final String TOKEN_REDACTION_MARKER = "[REDACTED]";

    /** Classpath resource name for the bundled provisioning playbook. */
    static final String SETUP_RESOURCE = "ansible/host-setup.yml";

    /** Classpath resource name for the bundled teardown playbook. */
    static final String TEARDOWN_RESOURCE = "ansible/host-teardown.yml";

    private final Logger logger;
    private final HostConfigGroup hostConfig;

    /** Cached resolved SSH config path (with {@code ~} expanded). */
    private String resolvedSshConfigPath;

    public AnsibleHostProvisioner(Logger logger, HostConfigGroup hostConfig) {
        this.logger = logger;
        this.hostConfig = hostConfig;
    }

    @Override
    public ProvisionResult provision(String sshAlias, String agentToken) {
        List<String> command = buildProvisionCommand(sshAlias, agentToken);
        logger.debugv("Executing Ansible provisioning command for host {0}", sshAlias);
        return runAnsibleProcess(command, agentToken);
    }

    @Override
    public ProvisionResult deprovision(String sshAlias) {
        List<String> command = buildDeprovisionCommand(sshAlias);
        logger.debugv("Executing Ansible deprovisioning command for host {0}", sshAlias);
        return runAnsibleProcess(command, null);
    }

    /**
     * Resolves the {@code ~} in the SSH config path to the actual home directory.
     */
    String resolveSshConfigPath() {
        if (resolvedSshConfigPath == null) {
            resolvedSshConfigPath = Path.of(
                    hostConfig.sshConfigPath().replace(HOME_TILDE, System.getProperty(USER_HOME_PROPERTY)))
                    .toAbsolutePath().toString();
        }
        return resolvedSshConfigPath;
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
     * {@code ~/.ssh/config} via the {@code platform.host.ssh-config-path}
     * property.
     *
     * @param sshAlias   the SSH config alias (e.g., {@code db-server-1})
     * @param agentToken the bearer token to pass as an Ansible extra-var
     * @return the command array for ProcessBuilder
     */
    List<String> buildProvisionCommand(String sshAlias, String agentToken) {
        String playbook = resolvePlaybookPath(hostConfig.ansiblePlaybookPath(), SETUP_RESOURCE);
        String adHocInventory = sshAlias + AD_HOC_INVENTORY_SUFFIX;
        String extraVars = AGENT_TOKEN_VAR_PREFIX + agentToken + " ansible_become_timeout=60";
        String sshArgs = SSH_CONFIG_FLAG + " " + resolveSshConfigPath();
        return List.of(ANSIBLE_PLAYBOOK_BINARY, playbook,
                INVENTORY_FLAG, adHocInventory,
                SSH_EXTRA_ARGS_FLAG, sshArgs,
                EXTRA_VARS_FLAG, extraVars);
    }

    /**
     * Builds the command array for the deprovisioning (teardown) playbook.
     *
     * @param sshAlias the SSH config alias
     * @return the command array for ProcessBuilder
     */
    List<String> buildDeprovisionCommand(String sshAlias) {
        String playbook = resolvePlaybookPath(hostConfig.ansibleTeardownPath(), TEARDOWN_RESOURCE);
        String adHocInventory = sshAlias + AD_HOC_INVENTORY_SUFFIX;
        String sshArgs = SSH_CONFIG_FLAG + " " + resolveSshConfigPath();
        return List.of(ANSIBLE_PLAYBOOK_BINARY, playbook,
                INVENTORY_FLAG, adHocInventory,
                SSH_EXTRA_ARGS_FLAG, sshArgs);
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
    private ProvisionResult runAnsibleProcess(List<String> command,
                                              String tokenToRedact) {
        Process process = null;
        try {
            process = launchProcess(command);

            AnsibleOutputDrainer drainer = new AnsibleOutputDrainer(process, tokenToRedact,
                    this::logAnsibleOutputLine);
            Thread drainerThread = new Thread(drainer, "ansible-output-drainer");
            drainerThread.setDaemon(true);
            drainerThread.start();

            boolean finished = process.waitFor(hostConfig.ansibleTimeoutMinutes(), TimeUnit.MINUTES);

            drainerThread.join(TimeUnit.SECONDS.toMillis(DRAINER_JOIN_TIMEOUT_SECONDS));
            String output = drainer.getOutput();

            if (!finished) {
                process.destroyForcibly();
                String timeoutReport = "Ansible process timed out after "
                        + hostConfig.ansibleTimeoutMinutes() + " minutes\n" + output;
                logger.errorv("Ansible process timed out for command: {0}", command);
                return new ProvisionResult.Failure(timeoutReport);
            }

            int exitCode = process.exitValue();

            if (exitCode == SUCCESS_EXIT_CODE) {
                return new ProvisionResult.Success(output);
            }

            logger.errorv("Ansible process exited with code {0}", exitCode);
            return new ProvisionResult.Failure(output);
        }
        catch (IOException e) {
            String startFailureReport = "Failed to start Ansible process: " + e.getMessage();
            logger.errorv(e, "Failed to start Ansible process");
            return new ProvisionResult.Failure(startFailureReport);
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            if (process != null) {
                process.destroyForcibly();
            }
            return new ProvisionResult.Failure("Ansible execution interrupted");
        }
    }

    /**
     * Launches an OS process for the given command. Package-visible to
     * allow test overrides via Mockito spy.
     */
    Process launchProcess(List<String> command) throws IOException {
        ProcessBuilder builder = new ProcessBuilder(command)
                .redirectErrorStream(true);
        builder.environment().put("ANSIBLE_BECOME_TIMEOUT", "60");
        builder.environment().put("ANSIBLE_CALLBACKS_ENABLED",
                "ansible.posix.profile_tasks,ansible.posix.timer");
        return builder.start();
    }

    /**
     * Resolves the filesystem path to an Ansible playbook.
     *
     * <p>Resolution order:
     * <ol>
     *   <li>If the user explicitly configured a path <em>and</em> that file
     *       exists on disk, use it.</li>
     *   <li>Otherwise, load the bundled playbook from the classpath
     *       ({@code src/main/resources/ansible/}). In dev mode the resource
     *       is already a real file; in a packaged JAR it is extracted to a
     *       temporary file so that the external {@code ansible-playbook}
     *       process can read it.</li>
     * </ol>
     *
     * @param configuredPath  the user-configured path ({@code Optional.empty()}
     *                        when not set)
     * @param classpathResource  the classpath resource name to fall back to
     *                           (e.g. {@code "ansible/host-setup.yml"})
     * @return an absolute filesystem path to the playbook
     * @throws IllegalStateException if the playbook cannot be found anywhere
     */
    String resolvePlaybookPath(Optional<String> configuredPath, String classpathResource) {
        if (configuredPath.isPresent()) {
            Path userPath = Path.of(configuredPath.get());
            if (Files.exists(userPath)) {
                logger.infov("Using user-configured playbook: {0}", userPath.toAbsolutePath());
                return userPath.toAbsolutePath().toString();
            }
            logger.warnv("Configured playbook path does not exist: {0} — falling back to classpath resource",
                    configuredPath.get());
        }

        URL resourceUrl = Thread.currentThread().getContextClassLoader().getResource(classpathResource);
        if (resourceUrl != null) {
            try {
                if ("file".equals(resourceUrl.getProtocol())) {
                    String resolvedPath = Path.of(resourceUrl.toURI()).toAbsolutePath().toString();
                    logger.debugv("Using classpath playbook: {0}", resolvedPath);
                    return resolvedPath;
                }
                else {
                    String extractedPath = extractResourceToTempFile(classpathResource);
                    logger.debugv("Extracted classpath playbook to temp file: {0}", extractedPath);
                    return extractedPath;
                }
            }
            catch (URISyntaxException | IOException e) {
                throw new IllegalStateException(
                        "Failed to resolve classpath playbook: " + classpathResource, e);
            }
        }

        throw new IllegalStateException(
                "Ansible playbook not found — neither configured nor available on classpath: " + classpathResource);
    }

    /**
     * Extracts a classpath resource to a temporary file, returning its
     * absolute path. The temp file is marked for deletion on JVM exit.
     */
    private String extractResourceToTempFile(String resourceName) throws IOException {
        String prefix = resourceName.replace("/", "_").replace(".yml", "");
        Path tempFile = Files.createTempFile(prefix + "-", ".yml");
        tempFile.toFile().deleteOnExit();

        try (InputStream is = Thread.currentThread().getContextClassLoader().getResourceAsStream(resourceName)) {
            if (is == null) {
                throw new FileNotFoundException("Resource not found in classpath: " + resourceName);
            }
            Files.copy(is, tempFile, StandardCopyOption.REPLACE_EXISTING);
        }
        return tempFile.toAbsolutePath().toString();
    }

    /**
     * Logs a single line of Ansible output at the appropriate level.
     * Progress-relevant lines (task headers, play recap, fatal errors)
     * are logged at INFO so operators can track provisioning progress.
     * Everything else (timestamps, warnings, per-host results) goes
     * to DEBUG to keep the console clean.
     */
    private void logAnsibleOutputLine(String line) {
        if (isProgressLine(line)) {
            logger.infov("ansible | {0}", line);
        }
        else {
            logger.debugv("ansible | {0}", line);
        }
    }

    /**
     * Returns {@code true} if the Ansible output line conveys meaningful
     * progress to the user: task/play headers, the final recap result,
     * and fatal errors. Everything else (timestamps, warnings, empty
     * lines, per-task {@code ok/changed/skipping} results) is treated
     * as debug-level detail.
     */
    private static boolean isProgressLine(String line) {
        if (line == null || line.isBlank()) {
            return false;
        }
        String trimmed = line.trim();
        return trimmed.startsWith("TASK [")
                || trimmed.startsWith("PLAY [")
                || trimmed.startsWith("PLAY RECAP")
                || trimmed.startsWith("RUNNING HANDLER [")
                || trimmed.contains(": ok=")
                || trimmed.contains("fatal:");
    }

    /**
     * Drains a process's merged stdout+stderr stream line-by-line,
     * redacting any occurrence of the bearer token from the captured output.
     *
     * <p>Runs on a dedicated thread started before {@code process.waitFor()}
     * to prevent the OS pipe buffer (typically 64 KB) from filling up and
     * blocking the Ansible process.
     */
    static final class AnsibleOutputDrainer implements Runnable {

        private final Process process;
        private final String tokenToRedact;
        private final Consumer<String> lineCallback;
        private volatile String output = "";

        AnsibleOutputDrainer(Process process, String tokenToRedact, Consumer<String> lineCallback) {
            this.process = process;
            this.tokenToRedact = tokenToRedact;
            this.lineCallback = lineCallback;
        }

        @Override
        public void run() {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    String redacted = redactToken(line);
                    if (lineCallback != null) {
                        lineCallback.accept(redacted);
                    }
                    sb.append(redacted).append('\n');
                }
                output = sb.toString();
            }
            catch (IOException e) {
                output = "[Error reading Ansible output: " + e.getMessage() + "]\n";
            }
        }

        private String redactToken(String line) {
            if (tokenToRedact != null && line.contains(tokenToRedact)) {
                return line.replace(tokenToRedact, TOKEN_REDACTION_MARKER);
            }
            return line;
        }

        String getOutput() {
            return output;
        }
    }
}
