/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.agent;

import java.util.List;

/**
 * Describes one process invocation on the host.
 *
 * <p>Command objects declare what should be run. {@link DockerCommandRunner}
 * owns process creation, output capture, timeout handling, and logging.
 */
public interface HostCommand {

    List<String> arguments();
}
