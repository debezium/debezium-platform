package io.debezium.platform.api;


import io.debezium.platform.domain.PipelineService;
import io.debezium.platform.domain.LogStreamingService;
import io.debezium.platform.error.NotFoundException;
import io.quarkus.websockets.next.InboundProcessingMode;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnError;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.PathParam;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@WebSocket(
        path = "/api/pipelines/{id}/logs/stream",
        inboundProcessingMode = InboundProcessingMode.CONCURRENT
)
public class PipelineLogWebSocket {

    private static final org.slf4j.Logger log = LoggerFactory.getLogger(PipelineLogWebSocket.class);
    @Inject
    Logger logger;

    @Inject
    PipelineService pipelineService;

    @Inject
    LogStreamingService logStreamer;

    private final Map<String, LogStreamingService.LogStreamingTask> streamingTasks = new ConcurrentHashMap<>();


    @OnOpen
    @RunOnVirtualThread
    public void onOpen(@PathParam("id") String idString, WebSocketConnection connection) {
        logger.infof("Connection '%s' requesting logs for pipeline '%s',", connection.id(), idString);
        var id = Long.parseLong(idString);

        pipelineService
                .streamLogs(id, connection::sendTextAndAwait)
                .ifPresentOrElse(
                        task -> streamingTasks.put(connection.id(), task),
                        () -> {
                            throw new NotFoundException(id);
                        });
    }

    @OnError
    public void onError(WebSocketConnection connection, @PathParam("id") String idString, NumberFormatException e) {
        logger.warnf("Invalid pipeline id: %s", idString);

        connection.sendTextAndAwait("Invalid pipeline id");
        connection.closeAndAwait();
    }

    @OnError
    public void onError(WebSocketConnection connection, NotFoundException e) {
        logger.warnf("Pipeline not found: %s", e.getId());

        connection.sendTextAndAwait("Pipeline not found");
        connection.closeAndAwait();
    }

    @OnClose
    public void onClose(WebSocketConnection connection) {
        logger.debugf("Connection: %s closed", connection.id());

        var task = streamingTasks.remove(connection.id());
        if (task != null) {
            task.stop();
        }
    }

}
