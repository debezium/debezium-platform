package io.debezium.platform.environment.connection.destination.pulsar;

import org.apache.pulsar.client.admin.PulsarAdminBuilder;

public interface PulsarAdminProvider {
    PulsarAdminBuilder builder();
}
