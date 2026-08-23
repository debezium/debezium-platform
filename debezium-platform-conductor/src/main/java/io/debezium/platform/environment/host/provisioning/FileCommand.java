/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

/**
 * Creates a directory on the remote host via the Ansible {@code file} module.
 *
 * <p>Example: {@code ansible <host> -m file -a "path=/opt/configs state=directory mode=0755"}
 */
public record FileCommand(String dirPath) implements AnsibleCommand {

    @Override
    public String module() {
        return "file";
    }

    @Override
    public String buildArgs() {
        return "path=" + dirPath + " state=directory mode=0755";
    }
}
