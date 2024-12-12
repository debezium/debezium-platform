package io.debezium.platform.environment.watcher.consumers;

import java.util.Collection;
import java.util.Optional;
import java.util.function.BiConsumer;


/**
 * Event consumers
 * @param <T> payload type
 */
public interface EnvironmentEventConsumer<T> extends BiConsumer<Long, Optional<T>> {

    /**
     * @return collection of consumable aggregate types
     */
    Collection<String> consumedAggregates();

    /**
     * @return collection of consumable event types
     */
    Collection<String> consumedTypes();

    /**
     * @return consumed payload class
     */
    Class<T> consumedPayloadType();

    /**
     * Determines whether this consumer consumes events for given aggregate
     * and event types. By default, empty list returned by
     * {@link #consumedAggregates()} or {@link #consumedTypes()} is
     * treated as a wildcard.
     *
     * @param aggregateType event aggregate eventType
     * @param eventType event eventType
     * @return true if the event should be consumed false otherwise
     */
    default boolean consumes(String aggregateType, String eventType) {
        var aggregates = consumedAggregates();
        var types = consumedTypes();

        if (!aggregates.isEmpty() && !aggregates.contains(aggregateType)) {
            return false;
        }

        return types.isEmpty() || types.contains(eventType);
    }

    /**
     * Converts json payload into object accepted by this consumer
     * @param payload json payload
     *
     * @return converted payload object
     */
    T convert(String payload);

    /**
     * A shortcut method which takes event aggregate,type and payload.
     * Determines whether this consumer is applicable and if so, converts the payload and
     * calls {@link #accept(Object, Object)} )}.
     *
     * @param aggregateType event aggregate type
     * @param eventType event type
     * @param id aggregate id
     * @param payload json payload
     */
    default void consume(String aggregateType, String eventType, Long id, String payload) {
        if (consumes(aggregateType, eventType)) {
            var object = convert(payload);
            accept(id, Optional.ofNullable(object));
        }
    }
}
