/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

import java.io.IOException;
import java.nio.file.Path;

/**
 * Encapsulates a single Ansible ad-hoc command.
 *
 * <p>The Command pattern separates <em>what to do</em> (the command object)
 * from <em>how to run it</em> (the {@link AnsibleCommandRunner} invoker).
 * Each command knows its Ansible module and how to build the module
 * arguments, but knows nothing about process execution, timeouts, or
 * output capture.
 *
 * @see ShellCommand
 * @see CopyCommand
 * @see FileCommand
 */
public interface AnsibleCommand {

    /**
     * The Ansible module to use (e.g. {@code "shell"}, {@code "copy"},
     * {@code "file"}).
     */
    String module();

    /**
     * Builds the module arguments string passed via {@code -a}.
     *
     * @throws IOException if the command needs to create temp files
     *                     and that fails (only {@link CopyCommand})
     */
    String buildArgs() throws IOException;

    /**
     * Returns a temp file that should be cleaned up after execution,
     * or {@code null} if no cleanup is needed.
     */
    default Path tempFile() {
        return null;
    }
}
