package io.debezium.platform.environment.watcher;

import io.debezium.config.Configuration;
import io.debezium.connector.postgresql.PostgresConnector;
import io.debezium.connector.postgresql.PostgresConnectorConfig;
import io.debezium.embedded.Connect;
import io.debezium.embedded.EmbeddedEngineConfig;
import io.debezium.engine.DebeziumEngine;
import io.debezium.platform.environment.watcher.config.WatcherConfig;
import io.debezium.platform.environment.watcher.consumers.OutboxParentEventConsumer;
import io.debezium.transforms.outbox.EventRouter;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.Startup;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import org.jboss.logging.Logger;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@ApplicationScoped
@Startup
public class ConductorEnvironmentWatcher {

    private final Logger logger;
    private final OutboxParentEventConsumer eventConsumer;
    private final WatcherConfig watcherConfig;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private DebeziumEngine<?> engine;

    public ConductorEnvironmentWatcher(Logger logger, WatcherConfig watcherConfig, OutboxParentEventConsumer eventConsumer) {
        this.logger = logger;
        this.watcherConfig = watcherConfig;
        this.eventConsumer = eventConsumer;
    }

    @PostConstruct
    public void start() {
        if (!watcherConfig.watcher().enabled()) {
            logger.info("Skipping watcher because it is not enabled");
            return;
        }

        var connection = watcherConfig.connection();
        var offset = watcherConfig.watcher().offset();
        var outbox = watcherConfig.outbox();
        var extraFields = Stream.of(outbox.aggregateColumn(), outbox.aggregateIdColumn(), outbox.typeColumn())
                .map(c -> c + ":envelope")
                .collect(Collectors.joining(","));

        var config = Configuration.create()
                .with(EmbeddedEngineConfig.ENGINE_NAME, "conductor")
                .with(EmbeddedEngineConfig.CONNECTOR_CLASS, PostgresConnector.class.getName())
                .with(EmbeddedEngineConfig.OFFSET_STORAGE, offset.storage())
                .with(EmbeddedEngineConfig.OFFSET_STORAGE_FILE_FILENAME, offset.file())
                .with(PostgresConnectorConfig.TOPIC_PREFIX, "conductor")
                .with(PostgresConnectorConfig.HOSTNAME, connection.host())
                .with(PostgresConnectorConfig.PORT, connection.port())
                .with(PostgresConnectorConfig.USER, connection.username())
                .with(PostgresConnectorConfig.PASSWORD, connection.password())
                .with(PostgresConnectorConfig.DATABASE_NAME, connection.database())
                .with(PostgresConnectorConfig.PLUGIN_NAME, PostgresConnectorConfig.LogicalDecoder.PGOUTPUT.getValue())
                .with(PostgresConnectorConfig.INCLUDE_SCHEMA_CHANGES, false)
                .with(PostgresConnectorConfig.TABLE_INCLUDE_LIST, "public.%s".formatted(outbox.table()))
                .with("transforms", "outbox")
                .with("transforms.outbox.type", EventRouter.class.getName())
                .with("transforms.outbox.table.fields.additional.placement", extraFields)
                .build();

        logger.info("Creating Debezium engine");
        this.engine = DebeziumEngine.create(Connect.class)
                .using(config.asProperties())
                .notifying(eventConsumer)
                .build();

        logger.info("Attempting to start debezium engine");
        executor.execute(engine);
    }

    public void stop(@Observes ShutdownEvent event) {
        if (engine == null) {
            return;
        }

        try {
            logger.info("Attempting to stop Debezium");
            engine.close();
            executor.shutdown();
            executor.awaitTermination(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            logger.error("Exception while shutting down Debezium", e);
        }
    }
}
