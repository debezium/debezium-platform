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
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

import io.debezium.platform.environment.host.config.HostConfigGroup;

/**
 * Thin wrapper for running Ansible ad-hoc commands via {@link ProcessBuilder}.
 *
 * <p>Unlike {@link AnsibleHostProvisioner} (which runs full playbooks),
 * this runner executes single-purpose ad-hoc commands such as:
 * <ul>
 *   <li>{@code ansible <host> -m shell -a "docker run ..."}</li>
 *   <li>{@code ansible <host> -m copy -a "content='...' dest=..."}</li>
 *   <li>{@code ansible <host> -m shell -a "docker inspect ..."}</li>
 * </ul>
 *
 * <p>Output is captured synchronously (ad-hoc commands are fast, unlike
 * playbooks) with a configurable timeout. The merged stdout+stderr
 * approach prevents pipe-buffer deadlocks.
 *
 * @see AnsibleHostProvisioner
 */
@ApplicationScoped
public class AnsibleCommandRunner {

    private static final String ANSIBLE_BINARY = "ansible";
    private static final String INVENTORY_FLAG = "-i";
    private static final String MODULE_FLAG = "-m";
    private static final String ARGS_FLAG = "-a";
    private static final String SSH_EXTRA_ARGS_FLAG = "--ssh-extra-args";
    private static final String SSH_CONFIG_FLAG = "-F";
    private static final String BECOME_FLAG = "--become";
    private static final String AD_HOC_INVENTORY_SUFFIX = ",";
    private static final String HOME_TILDE = "~";
    private static final String USER_HOME_PROPERTY = "user.home";
    private static final int SUCCESS_EXIT_CODE = 0;

    /** Maximum wait time for ad-hoc commands (minutes). */
    private static final int AD_HOC_TIMEOUT_MINUTES = 5;

    private final Logger logger;
    private final HostConfigGroup hostConfig;

    /** Cached resolved SSH config path (with {@code ~} expanded). */
    private String resolvedSshConfigPath;

    public AnsibleCommandRunner(Logger logger, HostConfigGroup hostConfig) {
        this.logger = logger;
        this.hostConfig = hostConfig;
    }

    /**
     * Sealed result type for ad-hoc command execution.
     */
    public sealed interface CommandResult {
        record Success(String output) implements CommandResult {
        }

        record Failure(String output) implements CommandResult {
        }
    }

    /**
     * Runs an Ansible ad-hoc command using the {@code shell} module.
     *
     * @param sshAlias    the target host SSH alias
     * @param shellCommand the shell command to execute on the remote host
     * @return the command result with captured output
     */
    public CommandResult runShellCommand(String sshAlias, String shellCommand) {
        List<String> command = buildAdHocCommand(sshAlias, "shell", shellCommand);
        return executeCommand(command);
    }

    /**
     * Runs an Ansible ad-hoc command using the {@code copy} module
     * to upload content to a file on the remote host.
     *
     * @param sshAlias the target host SSH alias
     * @param content  the file content to upload
     * @param destPath the absolute path on the remote host
     * @return the command result
     */
    public CommandResult copyContent(String sshAlias, String content, String destPath) {
        String copyArgs = "content='" + content + "' dest=" + destPath + " mode=0644";
        List<String> command = buildAdHocCommand(sshAlias, "copy", copyArgs);
        return executeCommand(command);
    }

    /**
     * Runs an Ansible ad-hoc command using the {@code file} module
     * to create a directory on the remote host.
     *
     * @param sshAlias the target host SSH alias
     * @param dirPath  the absolute path of the directory to create
     * @return the command result
     */
    public CommandResult createDirectory(String sshAlias, String dirPath) {
        String fileArgs = "path=" + dirPath + " state=directory mode=0755";
        List<String> command = buildAdHocCommand(sshAlias, "file", fileArgs);
        return executeCommand(command);
    }

    private List<String> buildAdHocCommand(String sshAlias, String module, String moduleArgs) {
        String adHocInventory = sshAlias + AD_HOC_INVENTORY_SUFFIX;
        String sshArgs = SSH_CONFIG_FLAG + " " + resolveSshConfigPath();

        return List.of(
                ANSIBLE_BINARY, sshAlias,
                INVENTORY_FLAG, adHocInventory,
                MODULE_FLAG, module,
                ARGS_FLAG, moduleArgs,
                SSH_EXTRA_ARGS_FLAG, sshArgs,
                BECOME_FLAG);
    }

    private String resolveSshConfigPath() {
        if (resolvedSshConfigPath == null) {
            resolvedSshConfigPath = Path.of(
                    hostConfig.sshConfigPath().replace(HOME_TILDE, System.getProperty(USER_HOME_PROPERTY)))
                    .toAbsolutePath().toString();
        }
        return resolvedSshConfigPath;
    }

    private CommandResult executeCommand(List<String> command) {
        Process process = null;
        try {
            logger.debugv("Executing Ansible ad-hoc command: {0}", command);

            process = launchProcess(command);

            boolean finished = process.waitFor(AD_HOC_TIMEOUT_MINUTES, TimeUnit.MINUTES);
            String output = captureOutput(process);

            if (!finished) {
                process.destroyForcibly();
                String timeoutMessage = "Ansible ad-hoc command timed out after "
                        + AD_HOC_TIMEOUT_MINUTES + " minutes\n" + output;
                logger.errorv("Ansible ad-hoc command timed out: {0}", command);
                return new CommandResult.Failure(timeoutMessage);
            }

            int exitCode = process.exitValue();

            if (exitCode == SUCCESS_EXIT_CODE) {
                logger.debugv("Ansible ad-hoc command succeeded");
                return new CommandResult.Success(output);
            }

            logger.warnv("Ansible ad-hoc command failed with exit code {0}: {1}",
                    exitCode, output);
            return new CommandResult.Failure(output);
        }
        catch (IOException e) {
            logger.errorv(e, "Failed to start Ansible ad-hoc process");
            return new CommandResult.Failure("Failed to start Ansible process: " + e.getMessage());
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            if (process != null) {
                process.destroyForcibly();
            }
            return new CommandResult.Failure("Ansible execution interrupted");
        }
    }

    /**
     * Package-visible to allow test overrides.
     */
    Process launchProcess(List<String> command) throws IOException {
        return new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();
    }

    /**
     * Captures the complete output of a finished (or timed-out) process.
     * Since ad-hoc commands are short-lived, reading after waitFor is safe.
     */
    private static String captureOutput(Process process) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            return reader.lines().collect(Collectors.joining("\n"));
        }
        catch (IOException e) {
            return "[Error reading process output: " + e.getMessage() + "]";
        }
    }
}
