package io.debezium.platform.environment.connection.destination.pulsar;

import java.util.Map;

import org.apache.pulsar.client.admin.PulsarAdminBuilder;

public interface PulsarAuthHandler {
    void configure(PulsarAdminBuilder builder, Map<String, Object> config);

    void validate(Map<String, Object> config) throws IllegalArgumentException;

    default boolean isConfigValueMissing(Map<String, ?> config, String key) {
        return !config.containsKey(key) ||
                config.get(key) == null ||
                config.get(key).toString().trim().isEmpty();
    }
}
