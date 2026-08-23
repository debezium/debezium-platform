/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.provisioning;

/**
 * Sealed result type for Ansible ad-hoc command execution.
 *
 * <p>Every ad-hoc command returns either {@link Success} or {@link Failure}.
 * Pattern matching with {@code switch} ensures all cases are handled at
 * compile time — the compiler enforces exhaustiveness.
 */
public sealed interface CommandResult {

    record Success(String output) implements CommandResult {
    }

    record Failure(String output) implements CommandResult {
    }
}
