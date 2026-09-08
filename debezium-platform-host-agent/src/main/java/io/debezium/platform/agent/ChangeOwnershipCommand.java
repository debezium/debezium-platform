/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import java.nio.file.Path;
import java.util.List;

/**
 * Changes ownership of a host directory before it is bind-mounted into a
 * Debezium Server container.
 */
public record ChangeOwnershipCommand(String owner, Path directory) implements HostCommand {

    @Override
    public List<String> arguments() {
        return List.of("chown", owner, directory.toString());
    }
}
