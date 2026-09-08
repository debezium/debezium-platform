/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import jakarta.enterprise.context.ApplicationScoped;

import org.jboss.logging.Logger;

/**
 * Executes {@link HostCommand host commands} via {@link ProcessBuilder}.
 *
 * <p>This follows the Command pattern used by the Conductor's
 * {@code AnsibleCommandRunner}. The command object declares its arguments;
 * this runner executes it, drains output while it runs, and applies the
 * timeout consistently.
 *
 * <p>Most commands are Docker CLI commands, but the same execution boundary
 * also handles the ownership command required for bind-mounted data paths.
 */
@ApplicationScoped
public class DockerCommandRunner {

    private static final int DEFAULT_TIMEOUT_SECONDS = 120;

    private final Logger logger;

    public DockerCommandRunner(Logger logger) {
        this.logger = logger;
    }

    /**
     * Runs a host command synchronously and returns its output.
     *
     * @param command  command to execute
     * @return the command output with exit code and stdout/stderr
     */
    public CommandOutput run(HostCommand command) {
        Process process = null;
        try {
            logger.debugv("Executing: {0}", String.join(" ", command.arguments()));

            ProcessBuilder pb = new ProcessBuilder(command.arguments());
            pb.redirectErrorStream(true);
            process = pb.start();

            ProcessOutputDrainer drainer = new ProcessOutputDrainer(process);
            Thread drainerThread = Thread.ofVirtual().name("host-command-output-drainer").start(drainer);

            boolean finished = process.waitFor(DEFAULT_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                process.waitFor();
            }
            drainerThread.join();

            String output = drainer.output();
            if (!finished) {
                return new CommandOutput(124, "Command timed out after " + DEFAULT_TIMEOUT_SECONDS + " seconds\n" + output);
            }

            int exitCode = process.exitValue();
            logger.debugv("Command exited with code {0}: {1}", exitCode, output);
            return new CommandOutput(exitCode, output);
        }
        catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            if (process != null) {
                process.destroyForcibly();
            }
            logger.errorv(e, "Failed to execute command: {0}", String.join(" ", command.arguments()));
            return new CommandOutput(-1, "Process execution failed: " + e.getMessage());
        }
    }

    /**
     * Fires a host command asynchronously (fire-and-forget).
     *
     * <p>Used for {@code docker run} during deploy — the Agent returns
     * {@code 202 Accepted} immediately while Docker pulls the image and
     * starts the container in the background. The Conductor's status
     * poller will detect when the container is running.
     *
     * @param command  command to execute
     */
    public void runAsync(HostCommand command) {
        Thread.ofVirtual().name("docker-async").start(() -> {
            CommandOutput result = run(command);
            if (result.exitCode() != 0) {
                logger.warnv("Async Docker command failed (exit={0}): {1}",
                        result.exitCode(), result.output());
            }
        });
    }

    private static final class ProcessOutputDrainer implements Runnable {

        private final Process process;
        private String output = "";

        private ProcessOutputDrainer(Process process) {
            this.process = process;
        }

        @Override
        public void run() {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                output = reader.lines().collect(Collectors.joining("\n"));
            }
            catch (IOException e) {
                output = "[Error reading process output: " + e.getMessage() + "]";
            }
        }

        private String output() {
            return output;
        }
    }

    /**
     * Output of a Docker CLI command.
     *
     * @param exitCode  process exit code (0 = success)
     * @param output    combined stdout + stderr
     */
    public record CommandOutput(int exitCode, String output) {

        public boolean isSuccess() {
            return exitCode == 0;
        }
    }
}
