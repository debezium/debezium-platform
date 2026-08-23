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
import java.nio.file.Files;
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
 * <p>Each command is represented by an {@link AnsibleCommand} object
 * (Command pattern). The runner acts as the <em>invoker</em> — it builds
 * the process, executes it, captures output, and handles timeouts. The
 * command objects know only their module and arguments.
 *
 * <p>Output is captured synchronously (ad-hoc commands are fast, unlike
 * playbooks) with a configurable timeout. The merged stdout+stderr
 * approach prevents pipe-buffer deadlocks.
 *
 * @see AnsibleCommand
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
     * Runs an Ansible ad-hoc command using the {@code shell} module.
     *
     * @param sshAlias     the target host SSH alias
     * @param shellCommand the shell command to execute on the remote host
     * @return the command result with captured output
     */
    public CommandResult runShellCommand(String sshAlias, String shellCommand) {
        return execute(sshAlias, new ShellCommand(shellCommand));
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
        return execute(sshAlias, new CopyCommand(content, destPath));
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
        return execute(sshAlias, new FileCommand(dirPath));
    }

    /**
     * Executes an {@link AnsibleCommand} on the given host.
     *
     * <p>This is the single execution path for all ad-hoc commands.
     * It builds the process arguments, launches the process, waits for
     * completion (with timeout), and captures output. If the command
     * created a temp file (e.g. {@link CopyCommand}), it is cleaned
     * up in the {@code finally} block.
     *
     * @param sshAlias the target host SSH alias
     * @param command  the command to execute
     * @return the command result with captured output
     */
    CommandResult execute(String sshAlias, AnsibleCommand command) {
        Process process = null;
        try {
            String moduleArgs = command.buildArgs();
            List<String> processArgs = buildAdHocCommand(sshAlias, command.module(), moduleArgs);

            logger.debugv("Executing Ansible ad-hoc command: {0}", processArgs);

            process = launchProcess(processArgs);

            boolean finished = process.waitFor(AD_HOC_TIMEOUT_MINUTES, TimeUnit.MINUTES);
            String output = captureOutput(process);

            if (!finished) {
                process.destroyForcibly();
                logger.errorv("Ansible ad-hoc command timed out: {0}", processArgs);
                return new CommandResult.Failure("Ansible ad-hoc command timed out after "
                        + AD_HOC_TIMEOUT_MINUTES + " minutes\n" + output);
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
            logger.errorv(e, "Failed to execute Ansible ad-hoc command");
            return new CommandResult.Failure("Failed to execute Ansible command: " + e.getMessage());
        }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            if (process != null) {
                process.destroyForcibly();
            }
            return new CommandResult.Failure("Ansible execution interrupted");
        }
        finally {
            cleanupTempFile(command.tempFile());
        }
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

    /**
     * Package-visible to allow test overrides.
     */
    Process launchProcess(List<String> command) throws IOException {
        ProcessBuilder builder = new ProcessBuilder(command)
                .redirectErrorStream(true);
        builder.environment().put("ANSIBLE_BECOME_TIMEOUT", "60");
        return builder.start();
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

    /**
     * Cleans up a temp file created by a command, if any.
     */
    private void cleanupTempFile(Path tempFile) {
        if (tempFile != null) {
            try {
                Files.deleteIfExists(tempFile);
            }
            catch (IOException e) {
                logger.warnv(e, "Failed to delete temp file {0}", tempFile);
            }
        }
    }
}
