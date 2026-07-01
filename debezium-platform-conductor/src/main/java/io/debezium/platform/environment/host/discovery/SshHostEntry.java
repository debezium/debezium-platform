/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.host.discovery;

/**
 * Holds the parsed connection details for a single Host block from an OpenSSH
 * {@code ~/.ssh/config} file.
 *
 * <p>Instances are produced by {@link SshConfigParser} and consumed by
 * {@code SshConfigWatcherService} to reconcile host state
 * in the database.
 *
 * <p>All fields reflect values from the SSH config file. {@code hostname},
 * {@code user}, and {@code identityFile} are nullable — not every SSH config
 * entry specifies all fields. {@code port} defaults to 22 when absent.
 */
public record SshHostEntry(
        String alias,
        String hostname,
        String user,
        int port,
        String identityFile) {
}
