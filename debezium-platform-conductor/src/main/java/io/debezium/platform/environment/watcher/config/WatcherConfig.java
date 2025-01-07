/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.watcher.config;

import jakarta.enterprise.context.Dependent;

import lombok.Getter;
import lombok.experimental.Accessors;

@Dependent
@Accessors(fluent = true)
@Getter
public final class WatcherConfig {

    private final WatcherConfigGroup watcher;
    private final OutboxConfigGroup outbox;
    private final ConnectionConfig connection;

    public record ConnectionConfig(String username, String password, String database, String host, int port) {
    }

    public WatcherConfig(DataSourceConfigGroup dsConfig, WatcherConfigGroup watcher, OutboxConfigGroup outbox) {
        this.watcher = watcher;
        this.outbox = outbox;
        this.connection = createConnectionConfig(dsConfig);
    }

    private static ConnectionConfig createConnectionConfig(DataSourceConfigGroup dsConfig) {
        var url = dsConfig.url();
        var hostStart = url.indexOf("://") + 3;
        var hostEnd = url.indexOf(":", hostStart);
        var portStart = hostEnd + 1;
        var portEnd = url.indexOf("/", portStart);
        var databaseStart = portEnd + 1;
        var databaseEnd = url.indexOf("?", databaseStart);

        var username = dsConfig.username();
        var password = dsConfig.password();
        var database = url.substring(databaseStart, (databaseEnd != -1) ? databaseEnd : url.length());
        var host = url.substring(hostStart, hostEnd);
        var port = url.substring(portStart, portEnd);

        return new ConnectionConfig(username, password, database, host, Integer.parseInt(port));
    }
}
