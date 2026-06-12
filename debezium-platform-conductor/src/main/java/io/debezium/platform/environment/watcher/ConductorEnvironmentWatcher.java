/*
 * Copyright Debezium Authors.
 *
 * Licensed under the Apache Software License version 2.0, available at http://www.apache.org/licenses/LICENSE-2.0
 */
package io.debezium.platform.environment.watcher;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.debezium.config.Configuration;
import io.debezium.connector.postgresql.PostgresConnector;
import io.debezium.connector.postgresql.PostgresConnectorConfig;
import io.debezium.connector.postgresql.PostgresConnectorConfig.AutoCreateMode;
import io.debezium.embedded.Connect;
import io.debezium.embedded.EmbeddedEngineConfig;
import io.debezium.engine.DebeziumEngine;
import io.debezium.heartbeat.DatabaseHeartbeatImpl;
import io.debezium.heartbeat.Heartbeat;
import io.debezium.platform.config.OffsetConfigGroup;
import io.debezium.platform.environment.watcher.config.WatcherConfig;
import io.debezium.platform.environment.watcher.consumers.OutboxParentEventConsumer;
import io.debezium.transforms.outbox.EventRouter;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.Startup;

@ApplicationScoped
@Startup
public class ConductorEnvironmentWatcher {

    private static final Logger LOGGER = LoggerFactory.getLogger(ConductorEnvironmentWatcher.class);

    public static final String CONFIG_PORTION = "\\.config";
    public static final String OFFSET_STORAGE_PREFIX = "offset.storage.";
    public static final String OFFSET_PREFIX = "offset.";
    private static final String HEARTBEAT_DEFAULT_ACTION_QUERY = """
            INSERT INTO public.heartbeat (id, timestamp) \
            VALUES (1, now()) \
            ON CONFLICT (id) DO UPDATE SET timestamp = now()\
            """;
    private final OutboxParentEventConsumer eventConsumer;
    private final WatcherConfig watcherConfig;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private DebeziumEngine<?> engine;

    public ConductorEnvironmentWatcher(WatcherConfig watcherConfig, OutboxParentEventConsumer eventConsumer) {
        this.watcherConfig = watcherConfig;
        this.eventConsumer = eventConsumer;
    }

    @PostConstruct
    public void start() {
        if (!watcherConfig.watcher().enabled()) {
            LOGGER.info("Skipping watcher because it is not enabled");
            return;
        }

        var connection = watcherConfig.connection();
        var watcher = watcherConfig.watcher();
        var offset = watcher.offset();
        var outbox = watcherConfig.outbox();
        var extraFields = Stream.of(outbox.aggregateColumn(), outbox.aggregateIdColumn(), outbox.typeColumn())
                .map(c -> c + ":envelope")
                .collect(Collectors.joining(","));

        Configuration.Builder configurationBuilder = Configuration.create()
                .with(EmbeddedEngineConfig.ENGINE_NAME, "conductor")
                .with(EmbeddedEngineConfig.CONNECTOR_CLASS, PostgresConnector.class.getName())
                .with(PostgresConnectorConfig.TOPIC_PREFIX, "conductor")
                .with(PostgresConnectorConfig.HOSTNAME, connection.host())
                .with(PostgresConnectorConfig.PORT, connection.port())
                .with(PostgresConnectorConfig.USER, connection.username())
                .with(PostgresConnectorConfig.PASSWORD, connection.password())
                .with(PostgresConnectorConfig.DATABASE_NAME, connection.database())
                .with(PostgresConnectorConfig.PLUGIN_NAME, PostgresConnectorConfig.LogicalDecoder.PGOUTPUT.getValue())
                .with(PostgresConnectorConfig.INCLUDE_SCHEMA_CHANGES, false)
                .with(PostgresConnectorConfig.TABLE_INCLUDE_LIST, "public.%s,public.heartbeat".formatted(outbox.table()))
                .with(PostgresConnectorConfig.PUBLICATION_AUTOCREATE_MODE, AutoCreateMode.FILTERED)
                .with(Heartbeat.HEARTBEAT_INTERVAL_PROPERTY_NAME, watcher.heartbeat().intervalMs())
                .with(DatabaseHeartbeatImpl.HEARTBEAT_ACTION_QUERY_PROPERTY_NAME,
                        watcher.heartbeat().actionQuery().orElse(HEARTBEAT_DEFAULT_ACTION_QUERY))
                .with("transforms", "outbox")
                .with("transforms.outbox.type", EventRouter.class.getName())
                .with("transforms.outbox.table.fields.additional.placement", extraFields)
                .with("transforms.outbox.predicate", "isOutboxTable")
                .with("predicates", "isOutboxTable")
                .with("predicates.isOutboxTable.type", "org.apache.kafka.connect.transforms.predicates.TopicNameMatches")
                .with("predicates.isOutboxTable.pattern", ".*\\.%s".formatted(outbox.table()));

        offsetConfigurations(offset).forEach(configurationBuilder::with);

        var config = configurationBuilder.build();

        LOGGER.info("Creating Debezium engine");
        this.engine = DebeziumEngine.create(Connect.class)
                .using(config.asProperties())
                .using((success, message, error) -> {
                    if (error != null) {
                        LOGGER.error("Debezium engine stopped with error: %s".formatted(message), error);
                    }
                    else {
                        LOGGER.info("Debezium engine stopped: success={}, message={}", success, message);
                    }
                })
                .notifying(eventConsumer)
                .build();

        LOGGER.info("Attempting to start debezium engine");
        executor.execute(engine);
    }

    private Map<String, String> offsetConfigurations(OffsetConfigGroup offset) {

        Map<String, String> config = new HashMap<>();

        config.put(EmbeddedEngineConfig.OFFSET_STORAGE.name(), offset.storage().type());
        offset.storage().config()
                .forEach((key, value) -> config.put(buildKey(OFFSET_STORAGE_PREFIX, key), value));

        offset.config()
                .forEach((key, value) -> config.put(buildKey(OFFSET_PREFIX, key), value));

        return config;
    }

    private String buildKey(String offsetStoragePrefix, String currentKey) {
        return offsetStoragePrefix + currentKey.replaceAll(CONFIG_PORTION, "");
    }

    public void stop(@Observes ShutdownEvent event) {
        if (engine == null) {
            return;
        }

        try {
            LOGGER.info("Attempting to stop Debezium");
            engine.close();
            executor.shutdown();
            executor.awaitTermination(10, TimeUnit.SECONDS);
        }
        catch (Exception e) {
            LOGGER.error("Exception while shutting down Debezium", e);
        }
    }
}
