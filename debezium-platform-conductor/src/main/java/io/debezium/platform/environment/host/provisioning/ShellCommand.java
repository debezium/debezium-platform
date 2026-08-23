/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

/**
 * Runs a shell command on the remote host via the Ansible {@code shell} module.
 *
 * <p>Example: {@code ansible <host> -m shell -a "docker run -d myimage"}
 */
public record ShellCommand(String shellCommand) implements AnsibleCommand {

    @Override
    public String module() {
        return "shell";
    }

    @Override
    public String buildArgs() {
        return shellCommand;
    }
}
